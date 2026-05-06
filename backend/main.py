from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import os
import re
import hmac
import hashlib
import requests
from groq import Groq
from datetime import datetime, timedelta
import razorpay

load_dotenv()

app = FastAPI()

# ✅ CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DUFFEL_API_KEY    = os.getenv("DUFFEL_API_KEY")
GROQ_API_KEY      = os.getenv("GROQ_API_KEY")
RAZORPAY_KEY_ID   = os.getenv("RAZORPAY_KEY_ID")
RAZORPAY_SECRET   = os.getenv("RAZORPAY_SECRET")
GOOGLE_CLIENT_ID  = os.getenv("GOOGLE_CLIENT_ID",
    "164546349235-i7eg4h4lrako81vmiooejdigjka6c1lu.apps.googleusercontent.com")

DUFFEL_BASE = "https://api.duffel.com"
DUFFEL_HEADERS = {
    "Authorization": f"Bearer {DUFFEL_API_KEY}",
    "Duffel-Version": "v2",
    "Content-Type": "application/json",
    "Accept": "application/json",
}

groq_client = Groq(api_key=GROQ_API_KEY)


def get_razorpay_client():
    if not RAZORPAY_KEY_ID or not RAZORPAY_SECRET:
        raise HTTPException(status_code=500, detail="Razorpay keys not configured in .env")
    return razorpay.Client(auth=(RAZORPAY_KEY_ID, RAZORPAY_SECRET))


# ───────────────────────────────────────────────────────────────
# HOME
# ───────────────────────────────────────────────────────────────
@app.get("/")
def home():
    return {"message": "SkyBook Backend Running 🚀 (Duffel + Groq + Google Auth + Razorpay)"}


# ───────────────────────────────────────────────────────────────
# GOOGLE AUTH — verify ID token server-side
# ───────────────────────────────────────────────────────────────
@app.post("/auth/google")
async def google_auth(data: dict):
    """
    Receives the Google credential JWT from the frontend.
    Verifies it with Google's tokeninfo endpoint (server-side).
    Returns user profile on success.
    """
    credential = data.get("credential")
    if not credential:
        raise HTTPException(status_code=400, detail="Missing credential")

    try:
        res = requests.get(
            f"https://oauth2.googleapis.com/tokeninfo?id_token={credential}",
            timeout=10
        )

        if res.status_code != 200:
            raise HTTPException(status_code=401, detail="Invalid Google token")

        token_info = res.json()

        # Validate audience
        aud = token_info.get("aud", "")
        if aud != GOOGLE_CLIENT_ID:
            raise HTTPException(status_code=401, detail="Token audience mismatch")

        # Check expiry
        exp = int(token_info.get("exp", 0))
        if datetime.utcnow().timestamp() > exp:
            raise HTTPException(status_code=401, detail="Token expired")

        user = {
            "id":       token_info.get("sub"),
            "email":    token_info.get("email"),
            "name":     token_info.get("name", token_info.get("email", "User")),
            "picture":  token_info.get("picture", ""),
            "verified": token_info.get("email_verified") == "true",
        }

        print(f"✅ Google Auth OK: {user['email']}")
        return user

    except HTTPException:
        raise
    except Exception as e:
        print("Google Auth Error:", e)
        raise HTTPException(status_code=401, detail="Authentication failed")


# ───────────────────────────────────────────────────────────────
# RAZORPAY — create order
# ───────────────────────────────────────────────────────────────
@app.post("/payment/create-order")
async def create_payment_order(data: dict):
    """
    Creates a Razorpay order.
    Body: { amount: int (paise), currency: str, receipt: str }
    """
    amount   = data.get("amount")
    currency = data.get("currency", "INR")
    receipt = data.get("receipt", f"rcpt_{datetime.now().strftime('%Y%m%d%H%M%S')}")
    receipt = str(receipt)[:40]
# FIX: limit to 40 characters (Razorpay requirement)


    if not amount or int(amount) <= 0:
        raise HTTPException(status_code=400, detail="Invalid amount")

    try:
        rz = get_razorpay_client()
        order = rz.order.create({
            "amount":          int(amount),
            "currency":        currency,
            "receipt":         receipt,
            "payment_capture": 1,
        })

        return {
            "razorpay_order_id": order["id"],
            "amount":            order["amount"],
            "currency":          order["currency"],
            "key_id":            RAZORPAY_KEY_ID,
        }

    except HTTPException:
        raise
    except Exception as e:
        print("Razorpay create-order error:", e)
        raise HTTPException(status_code=500, detail=f"Could not create payment order: {str(e)}")


# ───────────────────────────────────────────────────────────────
# RAZORPAY — verify payment signature
# ───────────────────────────────────────────────────────────────
@app.post("/payment/verify")
async def verify_payment(data: dict):
    """
    Verifies Razorpay HMAC-SHA256 signature.
    Body: { razorpay_order_id, razorpay_payment_id, razorpay_signature }
    """
    order_id   = data.get("razorpay_order_id")
    payment_id = data.get("razorpay_payment_id")
    signature  = data.get("razorpay_signature")

    if not all([order_id, payment_id, signature]):
        raise HTTPException(status_code=400, detail="Missing payment verification data")

    if not RAZORPAY_SECRET:
        raise HTTPException(status_code=500, detail="Razorpay secret not configured")

    try:
        msg      = f"{order_id}|{payment_id}"
        expected = hmac.new(
            RAZORPAY_SECRET.encode("utf-8"),
            msg.encode("utf-8"),
            hashlib.sha256
        ).hexdigest()

        if hmac.compare_digest(expected, signature):
            print(f"✅ Payment verified: {payment_id}")
            return {"success": True, "payment_id": payment_id}
        else:
            print(f"❌ Signature mismatch for: {payment_id}")
            raise HTTPException(status_code=400, detail="Payment signature verification failed")

    except HTTPException:
        raise
    except Exception as e:
        print("Signature verification error:", e)
        raise HTTPException(status_code=500, detail=str(e))


# ───────────────────────────────────────────────────────────────
# IATA HELPER
# ───────────────────────────────────────────────────────────────
def get_iata(city: str):
    try:
        city = city.strip()
        if len(city) == 3 and city.isalpha():
            return city.upper()
        res    = requests.get(f"{DUFFEL_BASE}/places/suggestions?query={city}", headers=DUFFEL_HEADERS)
        places = res.json().get("data", [])
        for place in places:
            if place.get("type") == "airport":
                return place.get("iata_code")
            elif place.get("type") == "city":
                return place.get("iata_city_code")
        return None
    except Exception as e:
        print("IATA Error:", e)
        return None


def safe_get(obj, *keys, default=None):
    for key in keys:
        if obj is None or not isinstance(obj, dict):
            return default
        obj = obj.get(key)
    return obj if obj is not None else default


def parse_duration(raw_dur):
    try:
        if not raw_dur:
            return "N/A"
        dur = raw_dur.replace("PT", "")
        hours = minutes = ""
        if "H" in dur:
            parts = dur.split("H")
            hours = parts[0] + "h "
            dur   = parts[1] if len(parts) > 1 else ""
        if "M" in dur:
            minutes = dur.replace("M", "") + "m"
        return (hours + minutes).strip() or "N/A"
    except:
        return "N/A"


# ───────────────────────────────────────────────────────────────
# GET FLIGHTS (DUFFEL)
# ───────────────────────────────────────────────────────────────
def get_flights(from_city: str, to_city: str, date: str, pax: int = 1, cabin: str = "economy"):
    try:
        from_iata = get_iata(from_city)
        to_iata   = get_iata(to_city)
        print(f"Searching: {from_iata} → {to_iata} on {date}")
        if not from_iata or not to_iata:
            return []

        payload = {
            "data": {
                "slices": [{"origin": from_iata, "destination": to_iata, "departure_date": date}],
                "passengers":  [{"type": "adult"}] * max(1, pax),
                "cabin_class": cabin
            }
        }

        res = requests.post(
            f"{DUFFEL_BASE}/air/offer_requests?return_offers=true",
            headers=DUFFEL_HEADERS, json=payload
        )
        if res.status_code != 201:
            print("Duffel Error:", res.status_code, res.text)
            return []

        offers = safe_get(res.json(), "data", "offers", default=[])
        if not offers:
            return []

        flights = []
        for idx, o in enumerate(offers[:20]):
            try:
                slices   = o.get("slices") or []
                if not slices:
                    continue
                slice_   = slices[0]
                segments = slice_.get("segments") or []
                if not segments:
                    continue
                seg      = segments[0]
                last_seg = segments[-1]

                op          = seg.get("operating_carrier") or {}
                airline_name = op.get("name") or "Unknown Airline"
                airline_code = op.get("iata_code") or "??"
                dur_str      = parse_duration(slice_.get("duration"))

                bags         = o.get("baggages") or []
                baggage_info = "15 kg"
                if bags and isinstance(bags[0], dict):
                    baggage_info = f"{(bags[0].get('quantity') or 1) * 15} kg"

                try:
                  price = float(o.get("total_amount") or 0)
                except:
                  price = 0.0

                currency = o.get("total_currency") or "USD"

                 # 🔥 FIX: Convert USD → INR
                USD_TO_INR = 95  # you can change later or make dynamic

                if currency == "USD":
                   price = price * USD_TO_INR
                   currency = "INR"

                currency  = o.get("total_currency") or "USD"
                dep_raw   = seg.get("departing_at") or ""
                arr_raw   = last_seg.get("arriving_at") or ""
                dep_time  = dep_raw[:16].replace("T", " ") if dep_raw else "N/A"
                arr_time  = arr_raw[:16].replace("T", " ") if arr_raw else "N/A"

                conditions    = o.get("conditions") or {}
                refund_before = conditions.get("refund_before_departure") or {}
                is_refundable = refund_before.get("allowed", False) or False

                flights.append({
                    "id":         o.get("id", f"offer_{idx}"),
                    "offer_id":   o.get("id", f"offer_{idx}"),
                    "airline":    {"name": airline_name, "code": airline_code, "icon": "✈️"},
                    "from":       from_iata,
                    "to":         to_iata,
                    "dep":        dep_time,
                    "arr":        arr_time,
                    "duration":   dur_str,
                    "stops":      max(0, len(segments) - 1),
                    "price":      round(price),
                    "totalPrice": round(price * max(1, pax)),
                    "currency":   currency,
                    "pax":        pax,
                    "class":      cabin.capitalize(),
                    "baggage":    baggage_info,
                    "meal":       False,
                    "refundable": bool(is_refundable),
                    "expires_at": o.get("expires_at") or "",
                    "passengers": o.get("passengers") or [],
                })
            except Exception as e:
                print(f"Offer {idx} parse error: {e}")
                continue

        flights.sort(key=lambda x: x["price"])
        print(f"Parsed {len(flights)} flights")
        return flights

    except Exception as e:
        print("get_flights Error:", e)
        return []


# ───────────────────────────────────────────────────────────────
# FLIGHT SEARCH ENDPOINT
# ───────────────────────────────────────────────────────────────
@app.get("/flights/search")
def search_flights(from_city: str, to_city: str, date: str, pax: int = 1, cabin: str = "economy"):
    flights = get_flights(from_city, to_city, date, pax, cabin)
    if not flights:
        raise HTTPException(status_code=404, detail="No flights found for this route.")
    return flights


# ───────────────────────────────────────────────────────────────
# BOOKING ENDPOINT
# ───────────────────────────────────────────────────────────────
# ───────────────────────────────────────────────────────────────
# ───────────────────────────────────────────────────────────────
# BOOKING ENDPOINT
# ───────────────────────────────────────────────────────────────
bookings_db = []

def format_dob(dob_str):
    try:
        if dob_str and len(dob_str) == 10 and dob_str[2] == "-":
            parts = dob_str.split("-")
            return f"{parts[2]}-{parts[1]}-{parts[0]}"
        return dob_str or "1990-01-01"
    except:
        return "1990-01-01"

@app.post("/booking")
def book_flight(data: dict):
    try:
        offer_id   = data.get("offer_id")
        passenger  = data.get("passenger", {})
        flight     = data.get("flight", {})
        payment_id = data.get("payment_id", "")

        if not offer_id:
            raise HTTPException(status_code=400, detail="offer_id is required")

        res = requests.get(f"{DUFFEL_BASE}/air/offers/{offer_id}", headers=DUFFEL_HEADERS)
        if res.status_code != 200:
            raise HTTPException(status_code=400, detail="Offer expired or invalid.")

        offer           = res.json().get("data") or {}
        passengers_list = offer.get("passengers") or [{}]
        passenger_id    = passengers_list[0].get("id") if passengers_list else None

        if not passenger_id:
            raise HTTPException(status_code=400, detail="Passenger ID not found in offer.")

        order_res = requests.post(
            f"{DUFFEL_BASE}/air/orders",
            headers=DUFFEL_HEADERS,
            json={
                "data": {
                    "type": "instant",
                    "selected_offers": [offer_id],
                    "passengers": [{
                        "id":           passenger_id,
                        "title":        passenger.get("title") or "mr",
                        "gender":       passenger.get("gender") or "m",
                        "given_name":   passenger.get("firstName") or "",
                        "family_name":  passenger.get("lastName") or "",
                        "born_on":      format_dob(passenger.get("dob")),
                        "email":        passenger.get("email") or "",
                        "phone_number": passenger.get("phone") or "+910000000000",
                        "type":         "adult"
                    }],
                    "payments": [{          # ✅ required by Duffel
                        "type":     "balance",
                        "currency": offer.get("total_currency") or "USD",
                        "amount":   offer.get("total_amount") or "0"
                    }]
                }
            }
        )

        if order_res.status_code not in [200, 201]:
            error_detail = order_res.json()
            print("❌ Duffel Error:", error_detail)
            raise HTTPException(status_code=400, detail=str(error_detail))

        order = order_res.json().get("data") or {}

        booking_record = {
            "booking_id":          f"SKY-{order.get('booking_reference', 'XXXXXX')}",
            "duffel_order_id":     order.get("id"),
            "booking_reference":   order.get("booking_reference"),
            "razorpay_payment_id": payment_id,
            "passenger":           passenger,
            "flight":              flight,
            "status":              "confirmed",
            "created_at":          datetime.utcnow().isoformat(),
        }

        bookings_db.append(booking_record)
        return {"status": "success", "booking": booking_record}

    except HTTPException:
        raise
    except Exception as e:
        print("Booking error:", e)
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/bookings")
def get_bookings():
    return bookings_db

# ═══════════════════════════════════════════════════════════════
# AI CHATBOT
# ═══════════════════════════════════════════════════════════════
SYSTEM_PROMPT = """You are SkyBook AI — a sharp, friendly, and highly capable flight booking assistant powered by live Duffel flight data.

YOUR IDENTITY:
- Name: SkyBook AI ✈️
- Role: Flight booking agent ONLY
- Personality: Professional, concise, helpful, proactive

WHAT YOU CAN DO:
1. Help users SEARCH for flights (live data provided when available)
2. COMPARE flights by price, duration, stops, airline
3. EXPLAIN booking steps clearly
4. Answer questions about: baggage, check-in, seat selection, cancellation, refunds, visa requirements, cabin classes
5. Recommend the BEST flight option from available results
6. Guide users step-by-step through the booking process
7. Handle greetings and small talk briefly

WHAT YOU MUST NOT DO:
- Answer questions unrelated to flights or travel
- If asked off-topic: "I'm SkyBook AI and I only assist with flight bookings. Ask me anything about flights! ✈️"

RESPONSE STYLE:
- Keep replies SHORT and SCANNABLE
- Use bullet points, emojis sparingly
- Always end with a helpful next-step prompt
"""


def extract_flight_details(text: str) -> dict:
    today    = datetime.now().strftime("%Y-%m-%d")
    tomorrow = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")
    prompt   = f"""Extract flight search details from this user message. Today is {today}.
User: "{text}"
Return ONLY valid JSON: {{"from_city":..., "to_city":..., "date":..., "pax":1, "cabin":"economy"}}"""
    try:
        r   = groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=200, temperature=0.1,
        )
        raw = r.choices[0].message.content.strip()
        raw = re.sub(r"^```[a-z]*\n?", "", raw)
        raw = re.sub(r"\n?```$", "", raw)
        import json
        return json.loads(raw)
    except Exception as e:
        print("Extraction error:", e)
        return {}


def needs_flight_search(text: str) -> bool:
    keywords = ["flight","flights","fly","flying","book","ticket","travel","from","to",
                "depart","route","cheap","available","find","search","show","airline","schedule"]
    return any(kw in text.lower() for kw in keywords)


def is_off_topic(text: str) -> bool:
    patterns = [r"\bcode\b",r"\bpython\b",r"\bjavascript\b",r"\bweather\b",
                r"\bsports\b",r"\bjoke\b",r"\brecipe\b",r"\bnews\b",
                r"\bstock\b",r"\bcrypto\b",r"\bmovie\b",r"\bmath\b"]
    return any(re.search(p, text.lower()) for p in patterns)


def format_flights_for_ai(flights: list, from_city: str, to_city: str, date: str) -> str:
    if not flights:
        return f"\n\n⚠️ No flights found for {from_city} → {to_city} on {date}."
    lines = [f"\n\n✅ LIVE FLIGHTS — {from_city} → {to_city} | {date} | Top {min(5,len(flights))} of {len(flights)}:\n"]
    for i, f in enumerate(flights[:5], 1):
        lines.append(
            f"[{i}] {f['airline']['name']} | 🕐 {f['dep']} → {f['arr']} | ⏱ {f['duration']} | "
            f"{'Non-stop' if f['stops']==0 else str(f['stops'])+' stop'} | "
            f"💰 {f['currency']} {f['price']}/pax | 🧳 {f['baggage']}"
        )
    lines.append(f"\nBest: {flights[0]['airline']['name']} @ {flights[0]['currency']} {flights[0]['price']}")
    return "\n".join(lines)


@app.post("/ai/chat")
async def chat(request: dict):
    try:
        messages  = request.get("messages", [])
        if not messages:
            return {"reply": "Hi! I'm SkyBook AI ✈️. Where would you like to fly today?"}

        user_text = messages[-1].get("content", "").strip()

        if is_off_topic(user_text):
            return {"reply": "I'm SkyBook AI and I only assist with flight bookings. Ask me anything about flights! ✈️"}

        flight_context = ""
        if needs_flight_search(user_text):
            details   = extract_flight_details(user_text)
            from_city = details.get("from_city")
            to_city   = details.get("to_city")
            date      = details.get("date")
            pax       = details.get("pax") or 1
            cabin     = details.get("cabin") or "economy"
            if from_city and to_city and not date:
                date = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")
            if from_city and to_city and date:
                flights        = get_flights(from_city, to_city, date, pax, cabin)
                flight_context = format_flights_for_ai(flights, from_city, to_city, date)

        groq_messages = [{"role": "system", "content": SYSTEM_PROMPT}]
        for i, m in enumerate(messages):
            role    = "assistant" if m["role"] == "assistant" else "user"
            content = m["content"]
            if i == len(messages) - 1 and flight_context:
                content += "\n\n[LIVE DATA]\n" + flight_context
            groq_messages.append({"role": role, "content": content})

        response = groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=groq_messages,
            max_tokens=500, temperature=0.55,
        )
        return {"reply": response.choices[0].message.content.strip()}

    except Exception as e:
        print("Chat error:", e)
        return {"reply": "⚠️ AI service temporarily unavailable. Please try again shortly."}
    # ═══════════════════════════════════════════════════════════════
# FLIGHT PRICE PREDICTION AI AGENT
# ═══════════════════════════════════════════════════════════════

@app.post("/ai/predict-price")
async def predict_price(data: dict):

    try:
        from_city = data.get("from_city")
        to_city = data.get("to_city")
        date = data.get("date")

        if not from_city or not to_city or not date:
            raise HTTPException(status_code=400, detail="Missing fields")

        days_left = (datetime.strptime(date, "%Y-%m-%d") - datetime.now()).days


        # Simple prediction intelligence logic
        if days_left <= 2:
            verdict = "BUY NOW"
            trend = "RISING 📈"
            confidence = 90

        elif days_left <= 7:
            verdict = "BUY NOW"
            trend = "LIKELY RISING 📈"
            confidence = 78

        elif days_left <= 21:
            verdict = "NEUTRAL"
            trend = "STABLE ➖"
            confidence = 65

        else:
            verdict = "WAIT"
            trend = "MAY DROP 📉"
            confidence = 72


        return {
            "route": f"{from_city} → {to_city}",
            "travel_date": date,
            "verdict": verdict,
            "confidence": confidence,
            "price_trend": trend,
            "best_booking_window": "2–5 weeks before departure",
            "summary": "Prediction based on booking window timing and airline pricing behavior."
        }

    except Exception as e:
        print("Prediction error:", e)
        raise HTTPException(status_code=500, detail="Prediction failed")