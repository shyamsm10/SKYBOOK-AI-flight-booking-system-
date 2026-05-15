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
# GET FLIGHTS (DUFFEL) — unchanged
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
# FLIGHT SEARCH ENDPOINT — unchanged
# ───────────────────────────────────────────────────────────────
@app.get("/flights/search")
def search_flights(from_city: str, to_city: str, date: str, pax: int = 1, cabin: str = "economy"):
    flights = get_flights(from_city, to_city, date, pax, cabin)
    if not flights:
        raise HTTPException(status_code=404, detail="No flights found for this route.")
    return flights


# ───────────────────────────────────────────────────────────────
# BOOKING ENDPOINT — unchanged
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
# AI AGENT — replaces the old chatbot section
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

TOOLS YOU HAVE
You have three tools. You decide when to call them — never wait to be asked.
- search_flights: call this whenever the user mentions a route, destination, date, or
  asks about availability, fares, or schedules. If no date given, default to tomorrow.
- predict_price: call this when the user asks if prices will rise, whether to book now,
  or mentions timing uncertainty. Chain it after search_flights when useful.
- get_fare_rules: call this when the user asks about cancellations, refunds, changes,
  baggage allowances, or policies for a specific airline.

WHEN SHOWING FLIGHT RESULTS
Present results naturally, like you've just pulled them up on a screen together.
Use this format exactly:

Here's what's available for [City] to [City] on [date]:

**[Airline Name]** · [H:MM AM/PM] → [H:MM AM/PM] · [Xh Ym] · [Non-stop / X stop] · ₹[price]
**[Airline Name]** · [H:MM AM/PM] → [H:MM AM/PM] · [Xh Ym] · [Non-stop / X stop] · ₹[price]

The [Airline] option is the strongest pick — [one specific reason: best price, fewest stops, or best timing].
Shall I go ahead and book that one?

WHEN DESTINATION IS IMPOSSIBLE OR NOT ON EARTH
Respond in ONE sentence only. Redirect immediately. No explanation. No emoji.
- "Our network covers Earth only. Where are you flying to?"
- "Interplanetary travel isn't quite there yet — where on Earth can I help you get to?"

WHEN USER GOES OFF-TOPIC
One sentence, professional redirect. No apology.
- "Flight bookings are my lane — what route can I sort out for you?"

WHEN NO FLIGHTS ARE FOUND
Honest, solution-oriented, brief:
- "Nothing came up for that route on [date]. Want me to check a day earlier or later?"

DATA PRIVACY — CRITICAL
NEVER expose: offer_id or any ID strings, IATA codes (unless user asked), API field names,
raw timestamps, raw currency codes (USD), internal keys, raw baggage values, expiry timestamps.

ALWAYS show: airline name only (IndiGo not 6E), human times (6:30 AM), clean prices (₹4,250),
readable stops (Non-stop), plain baggage (1 checked bag · 15 kg).

If a user asks for internal IDs or raw data:
"That's internal system data — not something I can share."

BANNED PHRASES
"As I mentioned", "I'm SkyBook AI", "I'd be happy to help", "Great question!",
"Certainly!", "Of course!", "sir", "ma'am", "How can I assist you today?",
"Feel free to ask", "Is there anything else?", "Unfortunately", "As an AI", "I apologize"

FORMAT RULES
- Never use emoji unless the user used them first
- Bold airline names in flight results only
- One question per reply, never two
- Max 3 sentences for non-flight answers
- Never repeat anything already said in the conversation
- Never use bullet points for conversational replies — only for flight listings
"""


# ───────────────────────────────────────────────────────────────
# TOOL DEFINITIONS — sent to LLM so it decides when to call them
# ───────────────────────────────────────────────────────────────

AGENT_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "search_flights",
            "description": (
                "Search for available flights between two cities on a given date using "
                "the Duffel API. Call this whenever the user asks about flights, fares, "
                "routes, schedules, or availability. If no date is given, use tomorrow's date."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "from_city": {
                        "type": "string",
                        "description": "Origin city name (e.g. 'Mumbai'). Must be a real Earth city or airport."
                    },
                    "to_city": {
                        "type": "string",
                        "description": "Destination city name. Must be a real Earth city or airport."
                    },
                    "date": {
                        "type": "string",
                        "description": "Travel date in YYYY-MM-DD format."
                    },
                    "passengers": {
                        "type": "integer",
                        "description": "Number of adult passengers. Default: 1.",
                        "default": 1
                    },
                    "cabin": {
                        "type": "string",
                        "enum": ["economy", "premium_economy", "business", "first"],
                        "description": "Cabin class. Default: economy.",
                        "default": "economy"
                    }
                },
                "required": ["from_city", "to_city", "date"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "predict_price",
            "description": (
                "Predict whether flight prices are likely to rise or fall and advise "
                "whether to book now or wait. Call this when the user asks about price "
                "trends, whether to book now, or expresses timing uncertainty."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "from_city": {"type": "string"},
                    "to_city":   {"type": "string"},
                    "date":      {"type": "string", "description": "Travel date YYYY-MM-DD"}
                },
                "required": ["from_city", "to_city", "date"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_fare_rules",
            "description": (
                "Get cancellation policy, refund rules, change fees, and baggage allowances "
                "for a specific airline. Call this when the user asks about cancellations, "
                "refunds, change fees, or baggage policies."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "airline": {
                        "type": "string",
                        "description": "Airline name, e.g. 'IndiGo' or 'Air India'"
                    },
                    "cabin": {
                        "type": "string",
                        "enum": ["economy", "premium_economy", "business", "first"],
                        "default": "economy"
                    }
                },
                "required": ["airline"]
            }
        }
    }
]


# ───────────────────────────────────────────────────────────────
# TOOL IMPLEMENTATIONS
# ───────────────────────────────────────────────────────────────

def _fmt_time(raw: str) -> str:
    try:
        return datetime.strptime(raw, "%Y-%m-%d %H:%M").strftime("%-I:%M %p")
    except Exception:
        return raw

def _fmt_stops(stops: int) -> str:
    return "Non-stop" if stops == 0 else f"{stops} stop{'s' if stops > 1 else ''}"

def _fmt_price(price: int) -> str:
    return f"₹{price:,}"


def agent_tool_search_flights(from_city: str, to_city: str, date: str,
                               passengers: int = 1, cabin: str = "economy") -> dict:
    """Calls the real Duffel get_flights() and returns clean data (no private fields)."""
    raw_flights = get_flights(from_city, to_city, date, passengers, cabin)

    if not raw_flights:
        return {
            "found":   False,
            "message": f"No flights found from {from_city} to {to_city} on {date}."
        }

    clean = []
    for f in raw_flights[:4]:
        clean.append({
            "airline":    f["airline"]["name"],
            "departs":    _fmt_time(f["dep"]),
            "arrives":    _fmt_time(f["arr"]),
            "duration":   f["duration"],
            "stops":      _fmt_stops(f["stops"]),
            "price":      _fmt_price(f["price"]),
            "baggage":    f"1 checked bag · {f['baggage']}",
            "refundable": f["refundable"],
            # offer_id kept here ONLY so the frontend can use it for booking
            # — the LLM is instructed never to show it to the user
            "offer_id":   f["offer_id"],
        })

    best = clean[0]
    return {
        "found":      True,
        "route":      f"{from_city} → {to_city}",
        "date":       date,
        "passengers": passengers,
        "cabin":      cabin,
        "options":    clean,
        "best_pick":  f"{best['airline']} at {best['price']} — lowest fare"
    }


def agent_tool_predict_price(from_city: str, to_city: str, date: str) -> dict:
    """Booking-window price prediction — same logic as your existing /ai/predict-price."""
    try:
        days_left = (datetime.strptime(date, "%Y-%m-%d") - datetime.now()).days
    except ValueError:
        days_left = 30

    if days_left <= 2:
        verdict, trend, confidence = "BUY NOW", "RISING",        90
    elif days_left <= 7:
        verdict, trend, confidence = "BUY NOW", "LIKELY RISING", 78
    elif days_left <= 21:
        verdict, trend, confidence = "NEUTRAL", "STABLE",        65
    else:
        verdict, trend, confidence = "WAIT",    "MAY DROP",      72

    return {
        "route":               f"{from_city} to {to_city}",
        "travel_date":         date,
        "verdict":             verdict,
        "confidence":          confidence,
        "price_trend":         trend,
        "best_booking_window": "2 to 5 weeks before departure"
    }


def agent_tool_get_fare_rules(airline: str, cabin: str = "economy") -> dict:
    """
    Returns fare rules for a given airline + cabin.
    Extend this dict with real API data if Duffel provides it for your routes.
    """
    rules = {
        "IndiGo": {
            "economy": {
                "cancellation": "Allowed up to 2 hours before departure. Fee: ₹3,000.",
                "changes":      "Date changes up to 2 hours before departure. Fee: ₹3,500.",
                "baggage":      "1 checked bag · 15 kg included. Extra: ₹500/kg.",
                "refundable":   False
            }
        },
        "Air India": {
            "economy": {
                "cancellation": "Allowed up to 4 hours before departure. Fee: ₹2,500.",
                "changes":      "Allowed up to 4 hours before departure. Fee: ₹2,000.",
                "baggage":      "1 checked bag · 25 kg included.",
                "refundable":   True
            },
            "business": {
                "cancellation": "Fully refundable up to 24 hours before departure.",
                "changes":      "Free date changes up to 24 hours before departure.",
                "baggage":      "2 checked bags · 32 kg each.",
                "refundable":   True
            }
        },
        "SpiceJet": {
            "economy": {
                "cancellation": "Allowed up to 4 hours before departure. Fee: ₹2,250.",
                "changes":      "Allowed up to 4 hours before departure. Fee: ₹2,750.",
                "baggage":      "1 checked bag · 15 kg included.",
                "refundable":   False
            }
        },
        "Vistara": {
            "economy": {
                "cancellation": "Allowed up to 2 hours before departure. Fee: ₹2,800.",
                "changes":      "Allowed up to 2 hours before departure. Fee: ₹3,200.",
                "baggage":      "1 checked bag · 15 kg included.",
                "refundable":   False
            },
            "business": {
                "cancellation": "Fully refundable up to 24 hours before departure.",
                "changes":      "Free changes up to 24 hours before departure.",
                "baggage":      "2 checked bags · 32 kg each.",
                "refundable":   True
            }
        },
    }

    cabin_rules = rules.get(airline, {}).get(cabin, {})
    if not cabin_rules:
        return {
            "airline": airline,
            "cabin":   cabin,
            "note":    "Detailed fare rules unavailable for this airline. Check their website directly."
        }

    return {"airline": airline, "cabin": cabin, **cabin_rules}


# Tool dispatcher
AGENT_TOOL_FUNCTIONS = {
    "search_flights": agent_tool_search_flights,
    "predict_price":  agent_tool_predict_price,
    "get_fare_rules": agent_tool_get_fare_rules,
}


# ───────────────────────────────────────────────────────────────
# THE AGENTIC LOOP
# ───────────────────────────────────────────────────────────────

def run_agent(messages: list, max_iterations: int = 5) -> str:
    """
    Core agent loop:
    1. Send messages + tool definitions to LLM.
    2. If LLM calls a tool → execute it → append result → loop.
    3. If LLM produces a text reply → return it.

    max_iterations prevents infinite loops.
    """
    groq_messages = [{"role": "system", "content": SYSTEM_PROMPT}] + messages

    for iteration in range(max_iterations):
        response = groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=groq_messages,
            tools=AGENT_TOOLS,
            tool_choice="auto",
            max_tokens=600,
            temperature=0.72,
        )

        message = response.choices[0].message

        # LLM wants to call one or more tools
        if message.tool_calls:
            # Append the assistant's tool-call decision to history
            groq_messages.append({
                "role":       "assistant",
                "content":    message.content or "",
                "tool_calls": [
                    {
                        "id":       tc.id,
                        "type":     "function",
                        "function": {
                            "name":      tc.function.name,
                            "arguments": tc.function.arguments
                        }
                    }
                    for tc in message.tool_calls
                ]
            })

            # Execute each tool and append its result
            for tool_call in message.tool_calls:
                fn_name = tool_call.function.name
                try:
                    args = json.loads(tool_call.function.arguments)
                except json.JSONDecodeError:
                    args = {}

                print(f"Agent calling tool: {fn_name}({args})")

                fn = AGENT_TOOL_FUNCTIONS.get(fn_name)
                if fn:
                    try:
                        result = fn(**args)
                    except Exception as e:
                        result = {"error": str(e)}
                else:
                    result = {"error": f"Unknown tool: {fn_name}"}

                groq_messages.append({
                    "role":         "tool",
                    "tool_call_id": tool_call.id,
                    "content":      json.dumps(result)
                })

            # Loop — LLM sees tool results and decides next step

        # LLM produced a final text reply
        else:
            return message.content.strip() if message.content else ""

    return "Something went wrong on my end. Try again in a moment."


# ───────────────────────────────────────────────────────────────
# AI CHAT ENDPOINT
# ───────────────────────────────────────────────────────────────

@app.post("/ai/chat")
async def chat(request: dict):
    """
    Accepts:  { "messages": [ { "role": "user"|"assistant", "content": "..." } ] }
    Returns:  { "reply": "..." }

    Pass the full conversation history each request so the agent
    has context across turns.
    """
    try:
        messages = request.get("messages", [])
        if not messages:
            return {"reply": "Happy to help — which route are you looking at?"}

        # Clean to only valid roles/fields Groq accepts
        clean_messages = [
            {"role": m["role"], "content": m["content"]}
            for m in messages
            if m.get("role") in ("user", "assistant") and m.get("content")
        ]

        reply = run_agent(clean_messages)
        return {"reply": reply}

    except Exception as e:
        print("Agent error:", e)
        return {"reply": "Something went wrong on my end. Try again in a moment."}


# ═══════════════════════════════════════════════════════════════
# FLIGHT PRICE PREDICTION ENDPOINT — kept as-is for direct use
# ═══════════════════════════════════════════════════════════════

@app.post("/ai/predict-price")
async def predict_price(data: dict):
    try:
        from_city = data.get("from_city")
        to_city   = data.get("to_city")
        date      = data.get("date")

        if not from_city or not to_city or not date:
            raise HTTPException(status_code=400, detail="Missing fields")

        result = agent_tool_predict_price(from_city, to_city, date)
        result["summary"] = "Prediction based on booking window timing and airline pricing behavior."
        return result

    except Exception as e:
        print("Prediction error:", e)
        raise HTTPException(status_code=500, detail="Prediction failed")
     
@app.post("/ai/compare")
async def compare_flights(data: dict):
    """
    Dedicated flight comparison — plain Groq call, no agent loop, no tools.
    Keeps the agent clean and compare fast with consistent JSON output.
    """
    try:
        a = data.get("flight_a", {})
        b = data.get("flight_b", {})
 
        def fmt(f):
            price = f.get("price", 0)
            if price > 100000:
                price = price / 100
            return (
                f"airline={f.get('airline', {}).get('name', '?')}, "
                f"price=INR {round(price):,}, "
                f"departure={_fmt_time(f.get('dep', ''))}, "
                f"duration={f.get('duration', 'N/A')}, "
                f"stops={f.get('stops', 0)}, "
                f"cabin={f.get('class', 'Economy')}, "
                f"baggage={f.get('baggage', '15 kg')}, "
                f"meal={'yes' if f.get('meal') else 'no'}, "
                f"refundable={'yes' if f.get('refundable') else 'no'}"
            )
 
        prompt = f"""Compare these two flights. Return ONLY valid JSON, no markdown, no extra text.
 
Flight A: {fmt(a)}
Flight B: {fmt(b)}
 
Return this exact JSON shape:
{{
  "winner": "A or B",
  "verdict": "2-3 sentence recommendation explaining which to pick and why",
  "flightA": {{
    "score": 0,
    "price_rating": "good/neutral/bad",
    "duration_rating": "good/neutral/bad",
    "baggage_rating": "good/neutral/bad",
    "meal_rating": "good/neutral/bad",
    "value_rating": "good/neutral/bad",
    "summary": "one line"
  }},
  "flightB": {{
    "score": 0,
    "price_rating": "good/neutral/bad",
    "duration_rating": "good/neutral/bad",
    "baggage_rating": "good/neutral/bad",
    "meal_rating": "good/neutral/bad",
    "value_rating": "good/neutral/bad",
    "summary": "one line"
  }}
}}"""
 
        response = groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {
                    "role": "system",
                    "content": "You are a flight comparison engine. Return only valid JSON. No markdown. No explanation."
                },
                {"role": "user", "content": prompt}
            ],
            max_tokens=600,
            temperature=0.2,
        )
 
        raw   = response.choices[0].message.content.strip()
        clean = re.sub(r"^```[a-z]*\n?", "", raw)
        clean = re.sub(r"\n?```$", "", clean)
        return json.loads(clean)
 
    except Exception as e:
        print("Compare error:", e)
        raise HTTPException(status_code=500, detail="Comparison failed")