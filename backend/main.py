from fastapi import FastAPI, HTTPException, Request
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
from collections import defaultdict
import time

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


# ═══════════════════════════════════════════════════════════════
# SECURITY & SANITY LAYER
# ═══════════════════════════════════════════════════════════════

_rate_store: dict = defaultdict(list)
RATE_LIMIT_REQUESTS = 30
RATE_LIMIT_WINDOW   = 60

def check_rate_limit(ip: str) -> bool:
    now = time.time()
    _rate_store[ip] = [t for t in _rate_store[ip] if now - t < RATE_LIMIT_WINDOW]
    if len(_rate_store[ip]) >= RATE_LIMIT_REQUESTS:
        return False
    _rate_store[ip].append(now)
    return True


FICTIONAL_LOCATIONS = {
    "mars", "venus", "jupiter", "saturn", "uranus", "neptune", "pluto",
    "mercury", "moon", "luna", "space", "orbit", "galaxy", "milky way",
    "asteroid", "comet", "nebula", "star", "sun", "solar system",
    "iss", "international space station", "hubble",
    "hogwarts", "wakanda", "narnia", "mordor", "gondor", "shire",
    "westeros", "winterfell", "king's landing", "asgard", "krypton",
    "tatooine", "coruscant", "endor", "pandora", "naboo", "kamino",
    "hoth", "dagobah", "mustafar", "alderaan", "bespin", "jakku",
    "neverland", "oz", "wonderland", "atlantis", "eldorado", "shangri-la",
    "camelot", "avalon", "valhalla", "olympus", "hell", "heaven",
    "middle earth", "rivendell", "rohan", "isengard",
    "internet", "metaverse", "virtual", "cyberspace", "cloud",
    "nowhere", "anywhere", "everywhere", "utopia", "dystopia",
}

def is_fictional_location(name: str) -> bool:
    if not name or name == "INVALID":
        return True
    return name.strip().lower() in FICTIONAL_LOCATIONS


# ─────────────────────────────────────────────────────────────
# INJECTION PATTERNS
# NOTE: Do NOT include airline names ("duffel", "indigo", etc.)
#       or common booking words here — they are user vocabulary.
# ─────────────────────────────────────────────────────────────
INJECTION_PATTERNS = [
    # Function/code patterns
    r"get_flights\s*\(",
    r"search_flights\s*\(",
    r"extract_flight_details\s*\(",
    r"format_flights_for_ai\s*\(",
    r"get_iata\s*\(",
    r"book_flight\s*\(",
    r"\bdef\s+\w+\s*\(",
    r"\bimport\s+\w+",
    # Sensitive env / config leakage
    r"os\.environ",
    r"os\.getenv",
    r"DUFFEL_API_KEY",
    r"GROQ_API_KEY",
    r"RAZORPAY_KEY_ID",
    r"RAZORPAY_SECRET",
    r"\.env\b",
    # Classic prompt injection phrases
    r"ignore (previous|all|your) instructions",
    r"disregard (previous|all|your) (instructions|rules|prompt)",
    r"forget (everything|all|your instructions)",
    r"you are now\s+(?!going|ready|set|able)",  # allow "you are now going to…"
    r"new persona",
    r"act as (a )?(different|new|another|unrestricted)",
    r"pretend (you are|to be)",
    # Exfiltration attempts
    r"(reveal|show|print|display|output|return|expose|leak|dump).{0,30}(system prompt|api key|secret|token|config|env|internal|backend|variable)",
    r"(what is|show me|tell me|give me|print).{0,20}(your|the) (system prompt|instructions|api key|secret|token|config)",
    r"bypass.{0,20}(filter|restriction|rule|safety|guard|check)",
    r"jailbreak",
    # Role injection delimiters
    r"\[system\]",
    r"\[user\]",
    r"\[assistant\]",
    r"<system>",
    r"<prompt>",
    # Raw internal field names (only exact field names, not natural words)
    r"\boffer_id\s*[:=]",        # only flag as assignment/param, not natural mention
    r"\biata_?code\s*[:=]",
    r"\btotal_amount\s*[:=]",
    r"\bdeparting_at\s*[:=]",
    r"\barriving_at\s*[:=]",
    r"\bcabin_class\s*[:=]",
    r"\bpassenger_id\s*[:=]",
]
_INJECTION_RE = [re.compile(p, re.IGNORECASE) for p in INJECTION_PATTERNS]

def detect_injection(text: str) -> bool:
    return any(pattern.search(text) for pattern in _INJECTION_RE)

MAX_INPUT_LENGTH = 500

def sanitize_input(text: str):
    if not text or not text.strip():
        return "", "Empty message."
    if len(text) > MAX_INPUT_LENGTH:
        return "", f"Message too long. Please keep it under {MAX_INPUT_LENGTH} characters."
    cleaned = re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]', '', text)
    if detect_injection(cleaned):
        return "", "INJECTION_DETECTED"
    return cleaned.strip(), None


# ─────────────────────────────────────────────────────────────
# OUTPUT SCRUBBER — prevents internal data leaking in replies
# ─────────────────────────────────────────────────────────────
_LEAK_PATTERNS = [
    (r'\boff_[A-Za-z0-9_]+\b',                          "[FLIGHT_REF]"),
    (r'\bord_[A-Za-z0-9_]+\b',                          "[ORDER_REF]"),
    (r'offer_id\s*[:=]\s*\S+',                           "flight reference"),
    (r'total_amount\s*[:=]\s*\S+',                       "price"),
    (r'departing_at\s*[:=]\s*\S+',                       "departure time"),
    (r'arriving_at\s*[:=]\s*\S+',                        "arrival time"),
    (r'\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[Z+\-]\S*',  "[TIME]"),
    (r'\bUSD\s+[\d,.]+',                                 "₹[PRICE]"),
    (r'\bINR\s+[\d,.]+',                                 "₹[PRICE]"),
    (r'Bearer\s+[A-Za-z0-9_\-\.]+',                     "[AUTH]"),
    (r'\[INTERNAL[^\]]*\]',                              ""),
    (r'\[LIVE DATA\]',                                   ""),
    (r'\[USER SESSION\]',                                ""),
    (r'\[ACTION:[A-Z_]+\]',                              ""),
    (r'\bDUFFEL_[A-Z_]+\b',                              "[CONFIG]"),
    (r'\bGROQ_[A-Z_]+\b',                                "[CONFIG]"),
    (r'\bRAZORPAY_[A-Z_]+\b',                            "[CONFIG]"),
    # Never expose raw function/parameter names in replies
    (r'\bget_flights\b',                                 "flight search"),
    (r'\bextract_flight_details\b',                      "flight details"),
    (r'\bformat_flights_for_ai\b',                       "flight results"),
    (r'\bget_iata\b',                                    "airport lookup"),
]
_LEAK_RE = [(re.compile(p, re.IGNORECASE), r) for p, r in _LEAK_PATTERNS]

def scrub_output(text: str) -> str:
    for pattern, replacement in _LEAK_RE:
        text = pattern.sub(replacement, text)
    return re.sub(r'  +', ' ', text).strip()


# ═══════════════════════════════════════════════════════════════
# WORKFLOW STATE MACHINE
# ═══════════════════════════════════════════════════════════════
#
# Full booking flow (purely derived from conversation history):
#
#   IDLE             → normal search / chat
#   FLIGHT_CHOSEN    → user picked a flight, not yet collecting details
#   NEED_LOGIN       → must sign in before proceeding
#   NEED_NAME        → collecting passenger full name
#   NEED_DOB         → collecting date of birth
#   NEED_PHONE       → collecting phone number
#   CONFIRM_DETAILS  → all details gathered, showing summary for approval
#   CONFIRM_PAYMENT  → details confirmed, showing price + asking payment consent
#   DONE             → user consented → action = PROCEED_TO_BOOKING
#
# ═══════════════════════════════════════════════════════════════
def detect_stage(messages: list, is_signed_in: bool) -> str:
    recent    = messages[-20:]
    bot_msgs  = [m.get("content", "") for m in recent if m.get("role") == "assistant"]
    user_msgs = [m.get("content", "") for m in recent if m.get("role") == "user"]

    if not bot_msgs or not user_msgs:
        return "IDLE"

    last_bot  = bot_msgs[-1].lower()
    last_user = user_msgs[-1].lower()

    EXIT_WORDS = [
        "cancel", "stop", "back", "nevermind", "noo", "no thanks",
        "forget it", "flight", "search", "from", "to",
    ]

    # ── Most specific stages first ───────────────────────────

    # CONFIRM_PAYMENT — bot showed price and asked for payment consent
    if ("total price" in last_bot or "₹" in last_bot) and \
       ("proceed to payment" in last_bot or "confirm and pay" in last_bot or "pay ₹" in last_bot):
        return "CONFIRM_PAYMENT"

    # CONFIRM_DETAILS — bot showed name/dob/phone summary and asked to confirm
    if ("shall i go ahead" in last_bot or "lock this in" in last_bot) \
       and "phone:" in last_bot and "date of birth:" in last_bot:
        return "CONFIRM_DETAILS"

    # NEED_PHONE — bot just asked for phone
    if "phone" in last_bot and ("reach you" in last_bot or "number" in last_bot):
        has_exit = any(w in last_user for w in EXIT_WORDS)
        if has_exit:
            return "IDLE"
        return "NEED_PHONE"

    # NEED_DOB — bot just asked for DOB
    if "date of birth" in last_bot or "dd-mm-yyyy" in last_bot:
        has_date = bool(re.search(r'\d{1,2}[-/]\d{1,2}[-/]\d{4}', last_user))
        has_exit = any(w in last_user for w in EXIT_WORDS)
        if has_exit or (not has_date and len(last_user.split()) > 4):
            return "IDLE"
        return "NEED_DOB"

    # NEED_NAME — bot just asked for name
    if "full name" in last_bot or "name on your id" in last_bot or "first and last" in last_bot:
        has_exit = any(w in last_user for w in EXIT_WORDS)
        if has_exit:
            return "IDLE"
        return "NEED_NAME"

    # NEED_LOGIN — bot told user to sign in
    if "sign in" in last_bot and ("book" in last_bot or "moment" in last_bot):
        return "NEED_LOGIN"

    # FLIGHT_CHOSEN — flights shown and user now wants to book
    flights_shown = any(
        "what's available" in b.lower() or
        "strongest pick" in b.lower() or
        "here's what" in b.lower() or
        "which one works for you" in b.lower()
        for b in bot_msgs
    )
    booking_words = [
        "book", "yes", "confirm", "go ahead", "take it", "proceed",
        "yep", "yeah", "sure", "ok", "i'll take", "sounds good",
        "select", "choose", "pick",
        "airways", "airlines", "air india", "indigo", "spicejet",
        "that one", "this one", "first one", "second one",
    ]
    user_wants_to_book = any(w in last_user for w in booking_words)

    already_collecting = any(
        phrase in b.lower() for b in bot_msgs
        for phrase in ["full name", "date of birth", "phone", "name on your id"]
    )
    if flights_shown and user_wants_to_book and not already_collecting:
        return "FLIGHT_CHOSEN"

    return "IDLE"

def extract_name_from_text(text: str):
    m = re.search(
        r"(?:my name is|i'm|i am|name[:\s]+)\s*([A-Z][a-z]+)\s+([A-Z][a-z]+)",
        text, re.IGNORECASE
    )
    if m:
        return m.group(1).title(), m.group(2).title()
    m = re.search(r'\b([A-Z][a-z]{1,20})\s+([A-Z][a-z]{1,20})\b', text)
    if m:
        return m.group(1), m.group(2)
    parts = text.strip().split()
    if len(parts) >= 2:
        return parts[0].title(), parts[1].title()
    return None, None


def extract_dob_from_text(text: str):
    m = re.search(r'\b(\d{1,2}[-/]\d{1,2}[-/]\d{4})\b', text)
    if m:
        return m.group(1).replace("/", "-")
    return None


def extract_phone_from_text(text: str):
    cleaned = re.sub(r'[\s\-\(\)\.]', '', text)
    m = re.search(r'(\+?[\d]{10,13})', cleaned)
    if m:
        return m.group(1)
    return None


def get_collected_details(messages: list, user_email: str) -> dict:
    recent  = messages[-20:]
    details = {"email": user_email or ""}

    for i in range(len(recent) - 1):
        current  = recent[i]
        next_msg = recent[i + 1]
        if current.get("role") != "assistant" or next_msg.get("role") != "user":
            continue

        bot_text  = current.get("content", "").lower()
        user_text = next_msg.get("content", "")

        if ("full name" in bot_text or "name on your id" in bot_text or "first and last" in bot_text):
            fn, ln = extract_name_from_text(user_text)
            if fn and ln:
                details["firstName"] = fn
                details["lastName"]  = ln

        elif "date of birth" in bot_text or "dd-mm-yyyy" in bot_text:
            dob = extract_dob_from_text(user_text)
            if dob:
                details["dob"] = dob

        elif "phone" in bot_text and ("reach you" in bot_text or "number" in bot_text):
            phone = extract_phone_from_text(user_text)
            if phone:
                details["phone"] = phone

    return details


def get_selected_flight_price(messages: list) -> int:
    """
    Extract the price of the flight the user selected from the conversation history.
    Looks for the last price shown by the bot after a flight selection.
    """
    recent   = messages[-20:]
    bot_msgs = [m.get("content", "") for m in recent if m.get("role") == "assistant"]
    for msg in reversed(bot_msgs):
        # Look for ₹ followed by digits (e.g. ₹6,515 or ₹7200)
        m = re.search(r'₹([\d,]+)', msg)
        if m:
            try:
                return int(m.group(1).replace(",", ""))
            except:
                pass
    return 0


def run_workflow(stage: str, user_text: str, messages: list,
                 user_info: dict, is_signed_in: bool) -> dict | None:
    """
    Stateless booking workflow derived from conversation history.

    Full flow:
      FLIGHT_CHOSEN → (login check) → NEED_NAME → NEED_DOB → NEED_PHONE
      → CONFIRM_DETAILS → CONFIRM_PAYMENT → PROCEED_TO_BOOKING
    """
    user_email = user_info.get("email", "") if is_signed_in else ""

    # ── FLIGHT_CHOSEN — kick off the collection flow ──────────
    if stage == "FLIGHT_CHOSEN":
        if not is_signed_in:
            return {
                "reply":  "To book, you'll need to sign in first — it only takes a moment.",
                "flights": [],
                "action": "REQUIRE_LOGIN",
            }
        return {
            "reply":  "Sure! Let's get you booked. What's the **full name on your ID**? (first and last name)",
            "flights": [],
            "action": None,
        }

    # ── NEED_LOGIN — user came back after login prompt ────────
    if stage == "NEED_LOGIN":
        if is_signed_in:
            return {
                "reply":  "Signed in. What's the **full name on your ID**? (first and last name)",
                "flights": [],
                "action": None,
            }
        return {
            "reply":  "Still need to sign in before we can proceed.",
            "flights": [],
            "action": "REQUIRE_LOGIN",
        }

    # ── NEED_NAME ─────────────────────────────────────────────
    if stage == "NEED_NAME":
        fn, ln = extract_name_from_text(user_text)
        if not fn or not ln:
            return {
                "reply":  "Need both first and last name — try 'Arjun Sharma'.",
                "flights": [],
                "action": None,
            }
        return {
            "reply":  f"Got it, {fn} {ln}. What's your **date of birth**? (DD-MM-YYYY)",
            "flights": [],
            "action": None,
        }

    # ── NEED_DOB ──────────────────────────────────────────────
    if stage == "NEED_DOB":
        dob = extract_dob_from_text(user_text)
        if not dob:
            return {
                "reply":  "Please use DD-MM-YYYY format — for example, 15-08-1995.",
                "flights": [],
                "action": None,
            }
        try:
            dob_parsed = datetime.strptime(dob, "%d-%m-%Y")
            age_days   = (datetime.now() - dob_parsed).days
            if age_days < 730:
                return {"reply": "Passenger must be at least 2 years old.", "flights": [], "action": None}
            if age_days > 43800:
                return {"reply": "That date of birth doesn't look right — please check and resend.", "flights": [], "action": None}
        except ValueError:
            return {"reply": "Please use DD-MM-YYYY format — for example, 15-08-1995.", "flights": [], "action": None}
        return {
            "reply":  "Best **phone number** to reach you?",
            "flights": [],
            "action": None,
        }

    # ── NEED_PHONE ────────────────────────────────────────────
    if stage == "NEED_PHONE":
        phone = extract_phone_from_text(user_text)
        if not phone or len(re.sub(r'\D', '', phone)) < 10:
            return {
                "reply":  "Need a valid phone number — at least 10 digits.",
                "flights": [],
                "action": None,
            }
        details        = get_collected_details(messages, user_email)
        details["phone"] = phone

        fn    = details.get("firstName", "")
        ln    = details.get("lastName",  "")
        dob   = details.get("dob",       "")
        email = details.get("email",     "")

        summary = (
            f"Here's what I have — please check:\n\n"
            f"**Name:** {fn} {ln}\n"
            f"**Date of birth:** {dob}\n"
            f"**Phone:** {phone}\n"
            f"**Email:** {email}\n\n"
            f"Shall I go ahead and lock this in? *(yes / no)*"
        )
        return {
            "reply":  summary,
            "flights": [],
            "action": None,
        }

    # ── CONFIRM_DETAILS — user approves passenger info ────────
    # Now show the price and ask for payment confirmation
    if stage == "CONFIRM_DETAILS":
        yes_words = ["yes", "yep", "yeah", "sure", "ok", "go ahead",
                     "confirm", "proceed", "lock it", "do it", "correct", "looks good"]
        no_words  = ["no", "nope", "wrong", "change", "edit", "update", "incorrect"]

        if any(w in user_text.lower() for w in no_words):
            return {
                "reply":  "No problem — what would you like to change? Name, date of birth, or phone?",
                "flights": [],
                "action": None,
            }

        if any(w in user_text.lower() for w in yes_words):
            details = get_collected_details(messages, user_email)
            if not details.get("firstName") or not details.get("dob") or not details.get("phone"):
                return {
                    "reply":  "Something's missing — let's start again. What's the **full name on your ID**?",
                    "flights": [],
                    "action": None,
                }
            # Retrieve the price that was shown for the selected flight
            price = get_selected_flight_price(messages)
            price_display = f"₹{price:,}" if price else "the fare shown"
            return {
                "reply": (
                    f"Details confirmed ✓\n\n"
                    f"**Total price:** {price_display} (includes taxes & fees)\n\n"
                    f"Ready to pay {price_display} and confirm this booking? "
                    f"*(Type **confirm and pay** to proceed, or **cancel** to stop)*"
                ),
                "flights": [],
                "action":  None,
            }

        return {
            "reply":  "Just need a yes or no — shall I lock in those details?",
            "flights": [],
            "action": None,
        }

    # ── CONFIRM_PAYMENT — user gives final consent to pay ─────
    if stage == "CONFIRM_PAYMENT":
        cancel_words = ["cancel", "no", "nope", "stop", "abort", "don't", "back out"]
        pay_words    = [
            "confirm and pay", "pay now", "confirm", "proceed",
            "yes", "yep", "sure", "go ahead", "do it", "ok",
        ]

        if any(w in user_text.lower() for w in cancel_words):
            return {
                "reply":  "Booking cancelled. No payment has been taken. What else can I help with?",
                "flights": [],
                "action": None,
            }

        if any(w in user_text.lower() for w in pay_words):
            details = get_collected_details(messages, user_email)
            if not details.get("firstName") or not details.get("dob") or not details.get("phone"):
                return {
                    "reply":  "Something's missing — let's restart. What's the **full name on your ID**?",
                    "flights": [],
                    "action": None,
                }
            return {
                "reply":     "Taking you to the secure payment page now — your details are pre-filled.",
                "flights":   [],
                "action":    "PROCEED_TO_BOOKING",
                "passenger": details,
            }

        return {
            "reply":  "Please type **confirm and pay** to proceed, or **cancel** to stop.",
            "flights": [],
            "action": None,
        }

    return None  # fall through to Groq


# ═══════════════════════════════════════════════════════════════
# HELPERS
# ═══════════════════════════════════════════════════════════════

def get_razorpay_client():
    if not RAZORPAY_KEY_ID or not RAZORPAY_SECRET:
        raise HTTPException(status_code=500, detail="Razorpay keys not configured in .env")
    return razorpay.Client(auth=(RAZORPAY_KEY_ID, RAZORPAY_SECRET))

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

def fmt_time(raw: str) -> str:
    try:
        return datetime.strptime(raw, "%Y-%m-%d %H:%M").strftime("%-I:%M %p")
    except:
        return raw

def fmt_stops(stops: int) -> str:
    return "Non-stop" if stops == 0 else f"{stops} stop{'s' if stops > 1 else ''}"

def fmt_price(price: int) -> str:
    return f"₹{price:,}"


# ═══════════════════════════════════════════════════════════════
# DUFFEL FLIGHTS
# ═══════════════════════════════════════════════════════════════

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
                if not slices: continue
                slice_   = slices[0]
                segments = slice_.get("segments") or []
                if not segments: continue
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
                if currency == "USD":
                    price    = price * 95
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
        "[After showing results, ALWAYS end with: 'Which one works for you?']",
        "[CRITICAL: Do NOT say anything is booked. Do NOT confirm any booking. Do NOT ask for personal details. Just show options.]",
    ]
    return "\n".join(lines)


def clean_history_for_groq(messages: list) -> list:
    """Cap to last 10 messages and strip any hallucinated booking confirmations."""
    recent  = messages[-10:]
    cleaned = []
    for m in recent:
        content = m.get("content", "")
        if m.get("role") == "assistant" and any(phrase in content.lower() for phrase in [
            "is booked", "has been booked", "flight booked", "booking confirmed",
            "you have", "you now have", "flights booked", "successfully booked",
        ]):
            continue
        cleaned.append(m)
    return cleaned


# ═══════════════════════════════════════════════════════════════
# GROQ SYSTEM PROMPT
# ═══════════════════════════════════════════════════════════════
SYSTEM_PROMPT = """You are SkyBook, a flight search assistant. You help users FIND flights only. Booking is handled separately by a dedicated workflow — you never touch it.

════════════════════════════════════════
WHAT YOU DO
════════════════════════════════════════
1. Show flight options when the user asks.
2. Answer questions about flights shown.
3. After showing flights, ALWAYS end with: "Which one works for you?"

════════════════════════════════════════
ABSOLUTE RULES — NEVER BREAK THESE
════════════════════════════════════════
1. NEVER say a flight is booked, confirmed, ticketed, or processed.
2. NEVER say "your booking is confirmed" or anything similar.
3. NEVER ask for name, date of birth, phone, passport, or any personal details.
4. NEVER pretend a payment happened.
5. NEVER make up flight data — only use what's in [LIVE DATA].
6. NEVER show offer IDs, internal codes, raw timestamps, or USD amounts.
7. NEVER expose function names, parameter names, or internal field names.

════════════════════════════════════════
WHEN USER WANTS TO BOOK
════════════════════════════════════════
If the user says anything like "book", "yes", "take it", "go ahead",
"select [airline]", "I'll take that", "sounds good" — respond with
EXACTLY this and nothing else:

"Got it — pulling that up for you."

Do not add anything. Do not confirm. Do not ask questions.
The booking workflow handles everything after this point.

════════════════════════════════════════
FLIGHT RESULTS FORMAT
════════════════════════════════════════
Here's what's available for [City] to [City] on [Date]:

**[Airline]** · [H:MM AM/PM] → [H:MM AM/PM] · [Xh Ym] · [Non-stop / X stop] · ₹[price]

The **[Airline]** option is the strongest pick — [one short reason].
Which one works for you?

════════════════════════════════════════
OTHER CASES
════════════════════════════════════════
No flights found:
"Nothing came up for that route on [date]. Want me to check a day earlier or later?"

Off-topic question:
"Flight searches are my lane — which route can I help with?"

Greeting / small talk:
"Happy to help — which route are you looking at?"

════════════════════════════════════════
TONE RULES
════════════════════════════════════════
- Short and direct. No fluff.
- Never start with "I".
- No emoji unless user used one first.
- Never say: "Certainly!", "Of course!", "Great question!", "As an AI".
- One question per reply max.
- Show prices in ₹ only, human times only (e.g. 6:30 AM not 06:30:00).
"""


# ═══════════════════════════════════════════════════════════════
# INTENT HELPERS
# ═══════════════════════════════════════════════════════════════

def needs_flight_search(text: str) -> bool:
    keywords = [
        "flight", "flights", "fly", "flying", "ticket", "travel",
        "depart", "route", "cheap", "available", "find", "search",
        "show", "airline", "schedule", "fare", "one way", "return",
    ]
    if re.search(r'\bfrom\b.+\bto\b', text.lower()):
        return True
    return any(kw in text.lower() for kw in keywords)


def is_booking_intent(text: str) -> bool:
    patterns = [
        r"\bbook\b", r"\bbook it\b", r"\bbook that\b",
        r"\byes\b", r"\byep\b", r"\byeah\b", r"\bsure\b",
        r"\bconfirm\b", r"\bgo ahead\b", r"\btake it\b", r"\bproceed\b",
        r"\bi('ll| will) take\b", r"\bsounds good\b", r"\blet'?s? do it\b",
        r"\bbook the\b", r"\bi want (that|this|the)\b", r"\bok\b",
        r"\bselect\b", r"\bchoose\b", r"\bpick (that|this|the)\b",
        r"\bselect .{0,30} to book\b", r"\bi('ll| will) go with\b",
        # airline name mentions as booking signal
        r"\bairways\b", r"\bairlines\b",
    ]
    return any(re.search(p, text.lower()) for p in patterns)


def is_off_topic(text: str) -> bool:
    patterns = [
        r"\bwrite (me )?(a |some )?(code|script|program)\b",
        r"\bpython tutorial\b", r"\bjavascript (help|tutorial)\b",
        r"\bstock (price|market|tips)\b", r"\bcrypto(currency)?\b",
        r"\bsports (score|match|team)\b", r"\btell me a joke\b",
        r"\brecipe for\b", r"\blatest news\b",
        r"\bmath (problem|equation|help)\b",
        r"\bwrite (an? )?(essay|poem|story)\b",
        r"\bwhat is (the meaning of|life|love)\b",
    ]
    return any(re.search(p, text.lower()) for p in patterns)


def extract_flight_details(text: str) -> dict:
    today  = datetime.now().strftime("%Y-%m-%d")
    prompt = f"""Extract flight search details from this user message. Today is {today}.
User: "{text}"
Return ONLY valid JSON:
{{"from_city": "city name or null", "to_city": "city name or null", "date": "YYYY-MM-DD or null", "pax": 1, "cabin": "economy"}}
If origin or destination is not a real Earth city/airport, set that field to "INVALID".
JSON only. No explanation."""
    try:
        r   = groq_client.chat.completions.create(
            model="meta-llama/llama-4-scout-17b-16e-instruct",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=200, temperature=0.1,
        )
        raw = r.choices[0].message.content.strip()
        raw = re.sub(r"^```[a-z]*\n?", "", raw)
        raw = re.sub(r"\n?```$", "", raw)
        return json.loads(raw)
    except Exception as e:
        print("Extraction error:", e)
        return {}


# ═══════════════════════════════════════════════════════════════
# BASIC ROUTES
# ═══════════════════════════════════════════════════════════════

@app.get("/")
def home():
    return {"message": "SkyBook Backend Running"}


@app.post("/auth/google")
async def google_auth(data: dict):
    credential = data.get("credential")
    if not credential:
        raise HTTPException(status_code=400, detail="Missing credential")
    try:
        res = requests.get(
            f"https://oauth2.googleapis.com/tokeninfo?id_token={credential}", timeout=10
        )
        if res.status_code != 200:
            raise HTTPException(status_code=401, detail="Invalid Google token")
        token_info = res.json()
        if token_info.get("aud") != GOOGLE_CLIENT_ID:
            raise HTTPException(status_code=401, detail="Token audience mismatch")
        if datetime.utcnow().timestamp() > int(token_info.get("exp", 0)):
            raise HTTPException(status_code=401, detail="Token expired")
        return {
            "id":       token_info.get("sub"),
            "email":    token_info.get("email"),
            "name":     token_info.get("name", token_info.get("email", "User")),
            "picture":  token_info.get("picture", ""),
            "verified": token_info.get("email_verified") == "true",
        }
    except HTTPException:
        raise
    except Exception as e:
        print("Google Auth Error:", e)
        raise HTTPException(status_code=401, detail="Authentication failed")


@app.post("/payment/create-order")
async def create_payment_order(data: dict):
    amount  = data.get("amount")
    receipt = str(data.get("receipt", f"rcpt_{datetime.now().strftime('%Y%m%d%H%M%S')}"))[:40]
    if not amount or int(amount) <= 0:
        raise HTTPException(status_code=400, detail="Invalid amount")
    try:
        rz    = get_razorpay_client()
        order = rz.order.create({
            "amount":   int(amount),
            "currency": data.get("currency", "INR"),
            "receipt":  receipt,
            "payment_capture": 1,
        })
        return {
            "razorpay_order_id": order["id"],
            "amount":   order["amount"],
            "currency": order["currency"],
            "key_id":   RAZORPAY_KEY_ID,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Could not create payment order: {str(e)}")


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
        expected = hmac.new(
            RAZORPAY_SECRET.encode("utf-8"),
            f"{order_id}|{payment_id}".encode("utf-8"),
            hashlib.sha256
        ).hexdigest()
        if hmac.compare_digest(expected, signature):
            return {"success": True, "payment_id": payment_id}
        raise HTTPException(status_code=400, detail="Payment signature verification failed")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/flights/search")
def search_flights(from_city: str, to_city: str, date: str, pax: int = 1, cabin: str = "economy"):
    for label, city in [("Origin", from_city), ("Destination", to_city)]:
        if is_fictional_location(city):
            raise HTTPException(status_code=400, detail=f"{label} '{city}' is not a real location.")
        if detect_injection(city):
            raise HTTPException(status_code=400, detail=f"Invalid {label.lower()} value.")
    try:
        travel_date = datetime.strptime(date, "%Y-%m-%d").date()
        if travel_date < datetime.now().date():
            raise HTTPException(status_code=400, detail="Travel date cannot be in the past.")
        if travel_date > (datetime.now() + timedelta(days=365)).date():
            raise HTTPException(status_code=400, detail="Travel date cannot be more than 1 year away.")
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD.")
    if not (1 <= pax <= 9):
        raise HTTPException(status_code=400, detail="Passenger count must be between 1 and 9.")
    flights = get_flights(from_city, to_city, date, pax, cabin)
    if not flights:
        raise HTTPException(status_code=404, detail="No flights found for this route.")
    return flights


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

        required_fields = {
            "firstName": passenger.get("firstName", "").strip(),
            "lastName":  passenger.get("lastName",  "").strip(),
            "email":     passenger.get("email",     "").strip(),
            "phone":     passenger.get("phone",     "").strip(),
            "dob":       passenger.get("dob",       "").strip(),
        }
        missing = [k for k, v in required_fields.items() if not v]
        if missing:
            raise HTTPException(status_code=400, detail=f"Missing: {', '.join(missing)}")
        if not payment_id:
            raise HTTPException(status_code=400, detail="Payment must be completed before booking.")
        if "@" not in required_fields["email"]:
            raise HTTPException(status_code=400, detail="Invalid email address.")
        if len(re.sub(r'\D', '', required_fields["phone"])) < 10:
            raise HTTPException(status_code=400, detail="Phone number must be at least 10 digits.")
        try:
            dob_parsed = datetime.strptime(passenger.get("dob"), "%d-%m-%Y")
            age_days   = (datetime.now() - dob_parsed).days
            if age_days < 730:
                raise HTTPException(status_code=400, detail="Passenger must be at least 2 years old.")
        except ValueError:
            raise HTTPException(status_code=400, detail="Date of birth must be in DD-MM-YYYY format.")

        res = requests.get(f"{DUFFEL_BASE}/air/offers/{offer_id}", headers=DUFFEL_HEADERS)
        if res.status_code != 200:
            raise HTTPException(status_code=400, detail="Offer expired or invalid.")

        offer        = res.json().get("data") or {}
        pax_list     = offer.get("passengers") or [{}]
        passenger_id = pax_list[0].get("id") if pax_list else None
        if not passenger_id:
            raise HTTPException(status_code=400, detail="Passenger ID not found in offer.")

        clean_phone = format_phone(passenger.get("phone", ""))

        order_res = requests.post(
            f"{DUFFEL_BASE}/air/orders", headers=DUFFEL_HEADERS,
            json={"data": {
                "type": "instant",
                "selected_offers": [offer_id],
                "passengers": [{
                    "id":           passenger_id,
                    "title":        passenger.get("title")  or "mr",
                    "gender":       passenger.get("gender") or "m",
                    "given_name":   passenger.get("firstName") or "",
                    "family_name":  passenger.get("lastName")  or "",
                    "born_on":      format_dob(passenger.get("dob")),
                    "email":        passenger.get("email")  or "",
                    "phone_number": clean_phone,
                    "type":         "adult",
                }],
                "payments": [{
                    "type":     "balance",
                    "currency": offer.get("total_currency") or "USD",
                    "amount":   offer.get("total_amount")   or "0",
                }],
            }}
        )
        if order_res.status_code not in [200, 201]:
            raise HTTPException(status_code=400, detail=str(order_res.json()))

        order  = order_res.json().get("data") or {}
        record = {
            "booking_id":          f"SKY-{order.get('booking_reference', 'XXXXXX')}",
            "duffel_order_id":     order.get("id"),
            "booking_reference":   order.get("booking_reference"),
            "razorpay_payment_id": payment_id,
            "passenger":           passenger,
            "flight":              flight,
            "status":              "confirmed",
            "created_at":          datetime.utcnow().isoformat(),
        }
        bookings_db.append(record)
        return {"status": "success", "booking": record}

    except HTTPException:
        raise
    except Exception as e:
        print("Booking error:", e)
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/bookings")
def get_bookings():
    return bookings_db


# ═══════════════════════════════════════════════════════════════
# PRICE PREDICTION & COMPARISON
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
            verdict, trend, confidence = "BUY NOW", "RISING", 90
        elif days_left <= 7:
            verdict, trend, confidence = "BUY NOW", "LIKELY RISING", 78
        elif days_left <= 21:
            verdict, trend, confidence = "NEUTRAL", "STABLE", 65
        else:
            verdict, trend, confidence = "WAIT", "MAY DROP", 72
        return {
            "route": f"{from_city} to {to_city}", "travel_date": date,
            "verdict": verdict, "confidence": confidence, "price_trend": trend,
            "best_booking_window": "2 to 5 weeks before departure",
            "summary": "Prediction based on booking window timing and airline pricing behavior.",
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail="Prediction failed")


@app.post("/ai/compare")
async def compare_flights(data: dict):
    try:
        flights = data.get("flights", [])
        if len(flights) < 2:
            raise HTTPException(status_code=400, detail="Need at least 2 flights to compare")
        a, b = flights[0], flights[1]

        def calc_score(f):
            score = 100
            price = float(f.get("price", 0))
            if price > 12000: score -= 20
            elif price > 8000: score -= 10
            score -= int(f.get("stops", 0)) * 10
            if not f.get("refundable"): score -= 10
            if not f.get("meal"):       score -= 5
            return max(score, 40)

        scoreA = calc_score(a)
        scoreB = calc_score(b)
        winner = "A" if scoreA >= scoreB else "B"

        def summary(f, idx):
            return (
                f"Flight {idx} — {f.get('airline',{}).get('name','?')}\n"
                f"Price: {fmt_price(f.get('price',0))}\n"
                f"Duration: {f.get('duration','N/A')}\n"
                f"Stops: {fmt_stops(f.get('stops',0))}\n"
                f"Baggage: {f.get('baggage','N/A')}\n"
                f"Refundable: {'Yes' if f.get('refundable') else 'No'}"
            )

        response = groq_client.chat.completions.create(
            model="meta-llama/llama-4-scout-17b-16e-instruct",
            messages=[
                {"role": "system", "content": "You are a professional flight comparison assistant."},
                {"role": "user",   "content": f"Compare these two flights in under 100 words and recommend one.\n\n{summary(a,1)}\n\n{summary(b,2)}"}
            ],
            max_tokens=180, temperature=0.5,
        )
        return {
            "success": True, "winner": winner,
            "flightA": {"score": scoreA, "duration_rating": "good" if a.get("stops",0)==0 else "bad", "baggage_rating": "good", "meal_rating": "good" if a.get("meal") else "bad"},
            "flightB": {"score": scoreB, "duration_rating": "good" if b.get("stops",0)==0 else "bad", "baggage_rating": "good", "meal_rating": "good" if b.get("meal") else "bad"},
            "verdict": response.choices[0].message.content.strip(),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Compare failed: {str(e)}")


# ═══════════════════════════════════════════════════════════════
# AI CHAT WITH FLIGHTS  — main endpoint
# ═══════════════════════════════════════════════════════════════

@app.post("/ai/chat-with-flights")
async def chat_with_flights(raw_request: Request):
    try:
        request      = await raw_request.json()
        client_ip    = raw_request.client.host if raw_request.client else "unknown"

        if not check_rate_limit(client_ip):
            return {"reply": "Too many requests. Please slow down.", "flights": [], "action": None}

        messages     = request.get("messages", [])
        user_info    = request.get("user") or {}
        user_info["selected_offer_id"] = request.get("selected_offer_id", "")
        is_signed_in = bool(user_info and user_info.get("email"))

        if not messages:
            return {"reply": "Happy to help — which route are you looking at?", "flights": [], "action": None}

        user_text = messages[-1].get("content", "").strip()

        user_text, err = sanitize_input(user_text)
        if err == "INJECTION_DETECTED":
            return {"reply": "That's not something I can help with. What flight are you looking for?", "flights": [], "action": None}
        if err:
            return {"reply": err, "flights": [], "action": None}

        if is_off_topic(user_text):
            return {"reply": "Flight bookings are my lane — what route can I sort out for you?", "flights": [], "action": None}

        # ── Detect current workflow stage ──────────────────────
        stage = detect_stage(messages, is_signed_in)
        print(f"[WORKFLOW] Stage: {stage} | Signed in: {is_signed_in} | User: '{user_text}'")

        workflow_stages = {"FLIGHT_CHOSEN", "NEED_LOGIN", "NEED_NAME", "NEED_DOB",
                           "NEED_PHONE", "CONFIRM_DETAILS", "CONFIRM_PAYMENT"}

        # ── Run workflow if we're mid-booking ──────────────────
        if stage in workflow_stages:
            result = run_workflow(stage, user_text, messages, user_info, is_signed_in)
            if result is not None:
                return result

        # ── Check for booking intent at IDLE stage ─────────────
        # Only intercept if flights were already shown and user isn't searching a new route
        has_route = (
            bool(re.search(r'\bfrom\b.+\bto\b', user_text.lower())) or
            bool(re.search(
                r'\b(delhi|mumbai|pune|bangalore|chennai|kolkata|hyderabad|dubai|london|'
                r'paris|singapore|bangkok|new york|toronto|goa|kochi|ahmedabad|jaipur)\b',
                user_text.lower()
            ))
        )

        if stage == "IDLE" and is_booking_intent(user_text) and not has_route:
            recent_bot_msgs = [m.get("content", "") for m in messages[-10:] if m.get("role") == "assistant"]
            flights_were_shown = any(
                "strongest pick"    in b.lower() or
                "here's what"       in b.lower() or
                "what's available"  in b.lower() or
                "which one works"   in b.lower() or
                "shall i go ahead"  in b.lower() or
                "confirm and pay"   in b.lower()
                for b in recent_bot_msgs
            )
            if flights_were_shown:
                result = run_workflow("FLIGHT_CHOSEN", user_text, messages, user_info, is_signed_in)
                if result is not None:
                    return result

        # ── Groq: flight search + general chat ────────────────
        flights        = []
        flight_context = ""

        if needs_flight_search(user_text) and (not is_booking_intent(user_text) or has_route):
            details   = extract_flight_details(user_text)
            from_city = details.get("from_city")
            to_city   = details.get("to_city")
            date      = details.get("date")
            pax       = details.get("pax")  or 1
            cabin     = details.get("cabin") or "economy"

            if from_city == "INVALID" or is_fictional_location(from_city):
                return {"reply": "Our network covers Earth only. What's the actual origin?", "flights": [], "action": None}
            if to_city == "INVALID" or is_fictional_location(to_city):
                return {"reply": "Our network covers Earth only. What's the actual destination?", "flights": [], "action": None}

            if from_city and to_city and not date:
                date = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")

            if from_city and to_city and date:
                flights        = get_flights(from_city, to_city, date, pax, cabin)
                flight_context = format_flights_for_ai(flights, from_city, to_city, date)

        safe_messages = clean_history_for_groq(messages)

        login_context = (
            f"\n\n[USER SESSION]\nSigned in: {'YES' if is_signed_in else 'NO'}"
            + (f"\nUser name: {user_info.get('name')}" if is_signed_in else "")
        )

        groq_messages = [{"role": "system", "content": SYSTEM_PROMPT + login_context}]
        for i, m in enumerate(safe_messages):
            role    = "assistant" if m["role"] == "assistant" else "user"
            content = m["content"]
            if i == len(safe_messages) - 1 and flight_context:
                content += "\n\n[LIVE DATA]\n" + flight_context
            groq_messages.append({"role": role, "content": content})

        response = groq_client.chat.completions.create(
            model="meta-llama/llama-4-scout-17b-16e-instruct",
            messages=groq_messages,
            max_tokens=500,
            temperature=0.72,
        )

        reply = scrub_output(response.choices[0].message.content.strip())

        return {
            "reply":     reply,
            "flights":   flights[:4],
            "action":    None,
            "passenger": None,
        }

    except Exception as e:
        print("chat_with_flights error:", e)
        return {"reply": "Something went wrong on my end. Try again in a moment.", "flights": [], "action": None}