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
import json

load_dotenv()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DUFFEL_API_KEY   = os.getenv("DUFFEL_API_KEY")
GROQ_API_KEY     = os.getenv("GROQ_API_KEY")
RAZORPAY_KEY_ID  = os.getenv("RAZORPAY_KEY_ID")
RAZORPAY_SECRET  = os.getenv("RAZORPAY_SECRET")
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID",
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
# PHONE NUMBER HELPER
# ───────────────────────────────────────────────────────────────
def format_phone(phone_str: str) -> str:
    if not phone_str:
        return "+910000000000"
    cleaned = re.sub(r'[\s\-\(\)\.]', '', phone_str.strip())
    if not cleaned.startswith('+'):
        if cleaned.startswith('0'):
            cleaned = '+91' + cleaned[1:]
        elif len(cleaned) == 10:
            cleaned = '+91' + cleaned
        else:
            cleaned = '+' + cleaned
    return cleaned


# ───────────────────────────────────────────────────────────────
# HOME
# ───────────────────────────────────────────────────────────────
@app.get("/")
def home():
    return {"message": "SkyBook Backend Running (Duffel + Groq + Google Auth + Razorpay)"}


# ───────────────────────────────────────────────────────────────
# GOOGLE AUTH
# ───────────────────────────────────────────────────────────────
@app.post("/auth/google")
async def google_auth(data: dict):
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

        aud = token_info.get("aud", "")
        if aud != GOOGLE_CLIENT_ID:
            raise HTTPException(status_code=401, detail="Token audience mismatch")

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
        print(f"Google Auth OK: {user['email']}")
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
    amount   = data.get("amount")
    currency = data.get("currency", "INR")
    receipt  = data.get("receipt", f"rcpt_{datetime.now().strftime('%Y%m%d%H%M%S')}")
    receipt  = str(receipt)[:40]

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
# RAZORPAY — verify payment
# ───────────────────────────────────────────────────────────────
@app.post("/payment/verify")
async def verify_payment(data: dict):
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
            print(f"Payment verified: {payment_id}")
            return {"success": True, "payment_id": payment_id}
        else:
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
        print(f"Searching: {from_iata} -> {to_iata} on {date}")
        if not from_iata or not to_iata:
            return []

        payload = {
            "data": {
                "slices":      [{"origin": from_iata, "destination": to_iata, "departure_date": date}],
                "passengers":  [{"type": "adult"}] * max(1, pax),
                "cabin_class": cabin,
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

                op           = seg.get("operating_carrier") or {}
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

                USD_TO_INR = 95
                if currency == "USD":
                    price    = price * USD_TO_INR
                    currency = "INR"

                dep_raw  = seg.get("departing_at") or ""
                arr_raw  = last_seg.get("arriving_at") or ""
                dep_time = dep_raw[:16].replace("T", " ") if dep_raw else "N/A"
                arr_time = arr_raw[:16].replace("T", " ") if arr_raw else "N/A"

                conditions    = o.get("conditions") or {}
                refund_before = conditions.get("refund_before_departure") or {}
                is_refundable = refund_before.get("allowed", False) or False

                flights.append({
                    "id":         o.get("id", f"offer_{idx}"),
                    "offer_id":   o.get("id", f"offer_{idx}"),
                    "airline":    {"name": airline_name, "code": airline_code},
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

        clean_phone = format_phone(passenger.get("phone", ""))
        print(f"Phone formatted: {passenger.get('phone')} -> {clean_phone}")

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
                        "phone_number": clean_phone,
                        "type":         "adult",
                    }],
                    "payments": [{
                        "type":     "balance",
                        "currency": offer.get("total_currency") or "USD",
                        "amount":   offer.get("total_amount") or "0",
                    }],
                }
            }
        )

        if order_res.status_code not in [200, 201]:
            error_detail = order_res.json()
            print("Duffel Error:", error_detail)
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

SYSTEM_PROMPT = """You are SkyBook, an AI flight booking assistant for a premium travel platform.

PERSONALITY
Warm, professional, and quietly confident. Think of a good airline lounge agent —
polished but never stiff, helpful but never groveling. You speak with quiet authority.
You never say "sir" or "ma'am". You never introduce yourself unprompted.
You never explain what you are or what you do — just do it.

VOICE
- Measured and clear. Never rushed, never padded.
- Warm without being familiar. Precise without being cold.
- Short sentences. Lead the conversation — offer the next step, don't wait to be asked.
- Never start a reply with "I".

OPENING / GREETINGS
Good examples:
- "Happy to help — which route are you looking at?"
- "Let's find you something. What's the origin and destination?"
- "Sure. What dates and route are you working with?"

Never say: "Hey", "Hi there", "Where are you headed?", "sir", "ma'am",
"How can I assist you today?", "I'm SkyBook AI"

WHEN SHOWING FLIGHT RESULTS
Present results naturally, like you've just pulled them up on a screen together.
Use this format:

Here's what's available for [City] to [City] on [date]:

**[Airline Name]** · [H:MM AM/PM] → [H:MM AM/PM] · [Xh Ym] · [Non-stop / X stop] · ₹[price]
**[Airline Name]** · [H:MM AM/PM] → [H:MM AM/PM] · [Xh Ym] · [Non-stop / X stop] · ₹[price]

The [Airline] option is the strongest pick — [one specific reason: best price, fewest stops, or best timing].
Shall I go ahead and book that one?

WHEN DESTINATION IS IMPOSSIBLE OR NOT ON EARTH
If the user asks for flights to or from planets, moons, space, fictional or non-existent places:
Respond in ONE sentence only. Redirect immediately. No explanation. No emoji.

Good examples:
- "We don't travel to those destinations — what's your actual route?"
- "Our network covers Earth only. Where are you flying to?"
- "No commercial routes there. What's the real destination?"
- "Interplanetary travel isn't quite there yet — where on Earth can I help you get to?"

Rules: one sentence, no "unfortunately", no listing what you CAN do, no emoji, dry wit is fine.

WHEN USER GOES OFF-TOPIC
One sentence, professional redirect. No apology. No lecture.
- "Flight bookings are my lane — what route can I sort out for you?"
- "That's outside what I handle. For flights, I'm at your service."

WHEN NO FLIGHTS ARE FOUND
Honest, solution-oriented, brief:
- "Nothing came up for that route on [date]. Want me to check a day earlier or later?"
- "No results for that one — could be a thin route. Try a nearby airport or flexible dates?"

DATA PRIVACY — CRITICAL
You have access to internal system data. Never expose any of it to the user.

NEVER show:
- offer_id or any ID strings (e.g. "off_00123abc...")
- IATA airport codes unless the user specifically asked (DEL, BOM, DXB)
- API field names (total_amount, departing_at, cabin_class, iata_code)
- Raw timestamps (2025-01-14T06:30:00Z) — always convert to readable time (6:30 AM)
- Raw currency codes (USD) — always show ₹ with the amount
- Internal keys, reference strings, or system identifiers of any kind
- Baggage raw values — say "1 checked bag · 15 kg" not "quantity: 1"
- Offer expiry timestamps — never mention these exist

SHOW instead:
- Airline name only, never its code (IndiGo not 6E, Air India not AI)
- Human times only (6:30 AM, not 06:30:00)
- Clean prices (₹4,250 — not INR 4250.0 or USD 44.7)
- Readable stops (Non-stop or 1 stop — not stops: 0)
- Plain baggage (1 checked bag · 15 kg)

If a user asks for internal IDs or raw data:
"That's internal system data — not something I can share. What would you like to know about the flight?"

BANNED PHRASES — never use these under any circumstances
"As I mentioned", "I'm SkyBook AI", "I'd be happy to help", "Great question!",
"Certainly!", "Of course!", "Please provide me with", "Let's try again",
"I only assist with", "sir", "ma'am", "Where are you headed?",
"How can I assist you today?", "Feel free to ask", "Is there anything else?",
"Unfortunately", "As an AI", "I apologize", "Allow me to", "Noted!"

WHAT YOU HANDLE
Flight search and comparison, fare rules, baggage allowances, cabin classes,
seat selection, check-in windows, cancellation and refund policies,
layover logistics, visa requirements at a high level. Nothing outside this.

FORMAT RULES
- Never use emoji unless the user used them first in this conversation
- Bold airline names in flight results only — nothing else
- One question per reply, never two
- Max 3 sentences for non-flight answers
- Never repeat anything already said in the conversation
- Never use bullet points for conversational replies — only for flight listings
"""


# ───────────────────────────────────────────────────────────────
# EXTRACT FLIGHT DETAILS
# ───────────────────────────────────────────────────────────────
def extract_flight_details(text: str) -> dict:
    today  = datetime.now().strftime("%Y-%m-%d")
    prompt = f"""Extract flight search details from this user message. Today is {today}.
User: "{text}"
Return ONLY valid JSON with these exact keys:
{{"from_city": "city name or null", "to_city": "city name or null", "date": "YYYY-MM-DD or null", "pax": 1, "cabin": "economy"}}
If origin or destination is not a real Earth city or airport (e.g. Mars, Venus, Moon, fictional place), set that field to "INVALID".
No explanation. No markdown. JSON only."""
    try:
        r   = groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=200,
            temperature=0.1,
        )
        raw = r.choices[0].message.content.strip()
        raw = re.sub(r"^```[a-z]*\n?", "", raw)
        raw = re.sub(r"\n?```$", "", raw)
        return json.loads(raw)
    except Exception as e:
        print("Extraction error:", e)
        return {}


# ───────────────────────────────────────────────────────────────
# INTENT DETECTION
# ───────────────────────────────────────────────────────────────
def needs_flight_search(text: str) -> bool:
    keywords = [
        "flight", "flights", "fly", "flying", "book", "ticket", "travel",
        "from", "depart", "route", "cheap", "available", "find", "search",
        "show", "airline", "schedule", "fare", "one way", "return",
    ]
    return any(kw in text.lower() for kw in keywords)


def is_off_topic(text: str) -> bool:
    hard_off_topic = [
        r"\bwrite (me )?(a |some )?(code|script|program)\b",
        r"\bpython tutorial\b",
        r"\bjavascript (help|tutorial)\b",
        r"\bstock (price|market|tips)\b",
        r"\bcrypto(currency)?\b",
        r"\bsports (score|match|team)\b",
        r"\btell me a joke\b",
        r"\brecipe for\b",
        r"\blatest news\b",
        r"\bmath (problem|equation|help)\b",
        r"\bwrite (an? )?(essay|poem|story)\b",
        r"\bwhat is (the meaning of|life|love)\b",
    ]
    return any(re.search(p, text.lower()) for p in hard_off_topic)


# ───────────────────────────────────────────────────────────────
# FORMAT FLIGHTS FOR AI — clean, no raw fields or emoji
# ───────────────────────────────────────────────────────────────
def fmt_time(raw: str) -> str:
    try:
        return datetime.strptime(raw, "%Y-%m-%d %H:%M").strftime("%-I:%M %p")
    except:
        return raw

def fmt_stops(stops: int) -> str:
    if stops == 0:
        return "Non-stop"
    return f"{stops} stop{'s' if stops > 1 else ''}"

def fmt_price(price: int) -> str:
    return f"₹{price:,}"

def format_flights_for_ai(flights: list, from_city: str, to_city: str, date: str) -> str:
    if not flights:
        return (
            f"[NO RESULTS] Route: {from_city} to {to_city} on {date}. "
            f"Tell the user nothing was found in one sentence and suggest trying a day earlier or later."
        )

    best  = flights[0]
    lines = [
        "[INTERNAL FLIGHT DATA — never show IDs, codes, raw field names, or timestamps to the user]",
        f"Route: {from_city} to {to_city} | Date: {date} | {len(flights)} options found",
        "",
        "Options (sorted by price):",
    ]

    for f in flights[:4]:
        lines.append(
            f"Airline: {f['airline']['name']} | "
            f"Departs: {fmt_time(f['dep'])} | Arrives: {fmt_time(f['arr'])} | "
            f"Duration: {f['duration']} | {fmt_stops(f['stops'])} | "
            f"Price: {fmt_price(f['price'])} per person | "
            f"Baggage: 1 checked bag · {f['baggage']} | "
            f"{'Refundable' if f['refundable'] else 'Non-refundable'}"
        )

    lines += [
        "",
        f"[Best value: {best['airline']['name']} at {fmt_price(best['price'])}]",
        f"[End your reply with: 'Shall I go ahead and book the {best['airline']['name']} flight?']",
    ]
    return "\n".join(lines)


# ───────────────────────────────────────────────────────────────
# AI CHAT ENDPOINT
# ───────────────────────────────────────────────────────────────
@app.post("/ai/chat")
async def chat(request: dict):
    try:
        messages  = request.get("messages", [])
        if not messages:
            return {"reply": "Happy to help — which route are you looking at?"}

        user_text = messages[-1].get("content", "").strip()

        # Hard off-topic check
        if is_off_topic(user_text):
            return {"reply": "Flight bookings are my lane — what route can I sort out for you?"}

        flight_context = ""

        if needs_flight_search(user_text):
            details   = extract_flight_details(user_text)
            from_city = details.get("from_city")
            to_city   = details.get("to_city")
            date      = details.get("date")
            pax       = details.get("pax") or 1
            cabin     = details.get("cabin") or "economy"

            # Catch non-Earth destinations before hitting Duffel
            if from_city == "INVALID" or to_city == "INVALID":
                return {"reply": "We don't travel to those destinations — what's your actual route?"}

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
            max_tokens=500,
            temperature=0.72,
        )
        return {"reply": response.choices[0].message.content.strip()}

    except Exception as e:
        print("Chat error:", e)
        return {"reply": "Something went wrong on my end. Try again in a moment."}


# ═══════════════════════════════════════════════════════════════
# FLIGHT PRICE PREDICTION
# ═══════════════════════════════════════════════════════════════
@app.post("/ai/predict-price")
async def predict_price(data: dict):
    try:
        from_city = data.get("from_city")
        to_city   = data.get("to_city")
        date      = data.get("date")

        if not from_city or not to_city or not date:
            raise HTTPException(status_code=400, detail="Missing fields")

        days_left = (datetime.strptime(date, "%Y-%m-%d") - datetime.now()).days

        if days_left <= 2:
            verdict    = "BUY NOW"
            trend      = "RISING"
            confidence = 90
        elif days_left <= 7:
            verdict    = "BUY NOW"
            trend      = "LIKELY RISING"
            confidence = 78
        elif days_left <= 21:
            verdict    = "NEUTRAL"
            trend      = "STABLE"
            confidence = 65
        else:
            verdict    = "WAIT"
            trend      = "MAY DROP"
            confidence = 72

        return {
            "route":               f"{from_city} to {to_city}",
            "travel_date":         date,
            "verdict":             verdict,
            "confidence":          confidence,
            "price_trend":         trend,
            "best_booking_window": "2 to 5 weeks before departure",
            "summary":             "Prediction based on booking window timing and airline pricing behavior.",
        }

    except Exception as e:
        print("Prediction error:", e)
        raise HTTPException(status_code=500, detail="Prediction failed")

# ═══════════════════════════════════════════════════════════════
# FLIGHT COMPARISON
# ═══════════════════════════════════════════════════════════════
@app.post("/ai/compare")
async def compare_flights(data: dict):
    try:
        flights = data.get("flights", [])

        if len(flights) < 2:
            raise HTTPException(
                status_code=400,
                detail="Need at least 2 flights to compare"
            )

        a = flights[0]
        b = flights[1]

        # ── SIMPLE SCORING ENGINE ──────────────────────────────

        def calc_score(f):

            score = 100

            # Price
            price = float(f.get("price", 0))

            if price > 12000:
                score -= 20
            elif price > 8000:
                score -= 10

            # Stops
            stops = int(f.get("stops", 0))
            score -= stops * 10

            # Refundable
            if not f.get("refundable"):
                score -= 10

            # Meal
            if not f.get("meal"):
                score -= 5

            return max(score, 40)

        scoreA = calc_score(a)
        scoreB = calc_score(b)

        winner = "A" if scoreA >= scoreB else "B"

        # ── AI ANALYSIS ────────────────────────────────────────

        def flight_summary(f, idx):
            airline_name = (
                f.get("airline", {}).get("name", "Unknown Airline")
            )

            return f"""
Flight {idx} — {airline_name}
Price: {fmt_price(f.get("price", 0))}
Duration: {f.get("duration", "N/A")}
Stops: {fmt_stops(f.get("stops", 0))}
Baggage: {f.get("baggage", "N/A")}
Refundable: {"Yes" if f.get("refundable") else "No"}
"""

        prompt = f"""
Compare these two flights naturally.

{flight_summary(a,1)}

{flight_summary(b,2)}

Keep it concise under 100 words.
End with one recommendation.
"""

        response = groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {
                    "role": "system",
                    "content": "You are a professional flight comparison assistant."
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            max_tokens=180,
            temperature=0.5,
        )

        analysis = response.choices[0].message.content.strip()

        # ── RESPONSE ───────────────────────────────────────────

        return {
            "success": True,

            "winner": winner,

            "flightA": {
                "score": scoreA,
                "duration_rating": "good" if a.get("stops",0) == 0 else "bad",
                "baggage_rating": "good",
                "meal_rating": "good" if a.get("meal") else "bad",
            },

            "flightB": {
                "score": scoreB,
                "duration_rating": "good" if b.get("stops",0) == 0 else "bad",
                "baggage_rating": "good",
                "meal_rating": "good" if b.get("meal") else "bad",
            },

            "verdict": analysis
        }

    except Exception as e:
        print("COMPARE ERROR:", str(e))

        raise HTTPException(
            status_code=500,
            detail=f"Compare failed: {str(e)}"
        )