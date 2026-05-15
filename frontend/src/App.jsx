import { useState, useEffect, useRef, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";
const API_BASE = "https://skybook-ai-flight-booking-system.onrender.com";
const GOOGLE_CLIENT_ID = "164546349235-i7eg4h4lrako81vmiooejdigjka6c1lu.apps.googleusercontent.com";
const SUPABASE_URL = "https://uhjuesjqzrfagmbpfczb.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_JY60rZfPfsGCnSr3pUsB5w_5ZpM499H";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ── FONTS & GLOBAL STYLES ─────────────────────────────────────────────────
const GlobalStyles = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;0,700;1,300;1,400&family=DM+Sans:wght@300;400;500;600&display=swap');

    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    :root {
      --ink:       #0f0e0c;
      --ink2:      #2a2825;
      --brown:     #5c3d2e;
      --terra:     #c1622f;
      --terra2:    #e07a52;
      --gold:      #c9a84c;
      --cream:     #faf6f0;
      --cream2:    #f2ece2;
      --sand:      #e8ddd0;
      --muted:     #8a7e74;
      --white:     #ffffff;
      --shadow:    0 4px 24px rgba(15,14,12,0.10);
      --shadow-lg: 0 12px 48px rgba(15,14,12,0.16);
      --radius:    14px;
      --display:   'Cormorant Garamond', Georgia, serif;
      --body:      'DM Sans', sans-serif;
      --transition: 0.22s cubic-bezier(.4,0,.2,1);
    }

    html { scroll-behavior: smooth; }

    body {
      font-family: var(--body);
      background: var(--cream);
      color: var(--ink);
      min-height: 100vh;
      -webkit-font-smoothing: antialiased;
    }

    /* ── NAV ── */
    nav {
      position: fixed; top: 0; left: 0; right: 0; z-index: 100;
      display: flex; align-items: center; justify-content: space-between;
      padding: 0 32px; height: 62px;
      background: rgba(250,246,240,0.88);
      backdrop-filter: blur(14px);
      border-bottom: 1px solid rgba(92,61,46,0.10);
      transition: background var(--transition);
    }
    .nav-logo {
      display: flex; align-items: center; gap: 10px;
      font-family: var(--display); font-size: 1.45rem; font-weight: 700;
      color: var(--ink); letter-spacing: -0.02em;
    }
    .nav-logo svg { color: var(--terra); }
    .nav-right { display: flex; align-items: center; gap: 12px; }
    .user-chip {
      display: flex; align-items: center; gap: 10px;
      background: var(--cream2); border-radius: 50px;
      padding: 5px 14px 5px 5px;
      border: 1px solid var(--sand);
    }
    .avatar {
      width: 30px; height: 30px; border-radius: 50%;
      background: var(--terra); color: var(--white);
      display: flex; align-items: center; justify-content: center;
      font-size: 0.8rem; font-weight: 700; text-transform: uppercase;
      overflow: hidden;
    }
    .avatar img { width: 100%; height: 100%; object-fit: cover; border-radius: 50%; }
    .user-name { font-size: 0.82rem; font-weight: 500; color: var(--ink2); }
    .sign-out-btn {
      background: none; border: none; cursor: pointer;
      font-size: 0.75rem; color: var(--muted); font-family: var(--body);
      padding: 2px 6px; border-radius: 4px; transition: color var(--transition);
    }
    .sign-out-btn:hover { color: var(--terra); }
    .btn-ghost {
      background: none; border: 1.5px solid var(--sand);
      color: var(--ink2); padding: 7px 18px; border-radius: 8px;
      cursor: pointer; font-size: 0.84rem; font-family: var(--body);
      font-weight: 500; transition: all var(--transition);
    }
    .btn-ghost:hover { border-color: var(--terra); color: var(--terra); }

    /* ── HERO ── */
    .hero {
      min-height: 100vh;
      background: linear-gradient(160deg, #1a0f0a 0%, #2d1a10 40%, #3d2515 100%);
      position: relative; overflow: hidden;
      display: flex; flex-direction: column;
    }
    .hero-particles {
      position: absolute; inset: 0; pointer-events: none;
      overflow: hidden;
    }
    .particle {
      position: absolute; border-radius: 50%;
      background: rgba(193,98,47,0.12);
      animation: drift linear infinite;
    }
    @keyframes drift {
      from { transform: translateY(100vh) rotate(0deg); opacity: 0; }
      10%  { opacity: 1; }
      90%  { opacity: 1; }
      to   { transform: translateY(-100px) rotate(360deg); opacity: 0; }
    }
    .hero-grid {
      position: absolute; inset: 0;
      background-image:
        linear-gradient(rgba(193,98,47,0.04) 1px, transparent 1px),
        linear-gradient(90deg, rgba(193,98,47,0.04) 1px, transparent 1px);
      background-size: 60px 60px;
    }

    /* ── FLIGHT ANIMATION ── */
    .flight-track {
      position: absolute; inset: 0; pointer-events: none; overflow: hidden; z-index: 1;
    }
    .animated-plane {
      position: absolute;
      animation: flyAcross linear infinite;
      will-change: transform;
    }
    .animated-plane svg {
      filter: drop-shadow(0 0 8px rgba(193,98,47,0.6));
    }
    .plane-trail {
      position: absolute;
      height: 1.5px;
      border-radius: 2px;
      background: linear-gradient(90deg, transparent, rgba(193,98,47,0.4), transparent);
      animation: trailFade linear infinite;
      transform-origin: left center;
    }
    @keyframes flyAcross {
      0%   { transform: translateX(-120px) translateY(0px); opacity: 0; }
      5%   { opacity: 1; }
      50%  { transform: translateX(55vw) translateY(-30px); opacity: 1; }
      95%  { opacity: 1; }
      100% { transform: translateX(calc(100vw + 120px)) translateY(-10px); opacity: 0; }
    }
    @keyframes flyAcross2 {
      0%   { transform: translateX(-120px) translateY(0px); opacity: 0; }
      5%   { opacity: 0.6; }
      50%  { transform: translateX(55vw) translateY(20px); opacity: 0.6; }
      95%  { opacity: 0.6; }
      100% { transform: translateX(calc(100vw + 120px)) translateY(15px); opacity: 0; }
    }
    @keyframes flyAcross3 {
      0%   { transform: translateX(-120px) translateY(0px) scaleX(-1); opacity: 0; }
      5%   { opacity: 0.4; }
      50%  { transform: translateX(calc(-55vw + 100vw)) translateY(-15px) scaleX(-1); opacity: 0.4; }
      95%  { opacity: 0.4; }
      100% { transform: translateX(calc(-100vw - 120px)) translateY(-10px) scaleX(-1); opacity: 0; }
    }
    @keyframes trailFade {
      0%   { opacity: 0; width: 0; }
      10%  { opacity: 0.6; }
      80%  { opacity: 0.4; }
      100% { opacity: 0; width: 160px; }
    }
    .dotted-path {
      position: absolute;
      width: 100%;
      pointer-events: none;
    }
    .dotted-path svg {
      width: 100%;
      height: 100%;
    }

    .hero-content {
      position: relative; z-index: 2;
      padding: 160px 64px 0;
      max-width: 700px;
      animation: fadeUp 0.9s cubic-bezier(.4,0,.2,1) both;
    }
    @keyframes fadeUp {
      from { opacity: 0; transform: translateY(32px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    .hero-eyebrow {
      display: inline-flex; align-items: center; gap: 8px;
      font-size: 0.75rem; font-weight: 600; letter-spacing: 0.12em;
      text-transform: uppercase; color: var(--terra2);
      background: rgba(193,98,47,0.12); border: 1px solid rgba(193,98,47,0.2);
      padding: 6px 14px; border-radius: 50px; margin-bottom: 28px;
    }
    .hero-title {
      font-family: var(--display); font-size: clamp(2.8rem, 6vw, 5rem);
      font-weight: 300; line-height: 1.08; letter-spacing: -0.02em;
      color: var(--cream); margin-bottom: 20px;
    }
    .hero-title em { font-style: italic; color: var(--terra2); }
    .hero-sub {
      font-size: 1.05rem; font-weight: 300; color: rgba(250,246,240,0.6);
      line-height: 1.7; max-width: 480px; margin-bottom: 40px;
    }
    .hero-cta { display: flex; gap: 14px; flex-wrap: wrap; }
    .btn-hero {
      padding: 14px 32px; border-radius: 10px;
      font-size: 0.9rem; font-weight: 600; cursor: pointer;
      font-family: var(--body); transition: all var(--transition);
      border: none;
    }
    .btn-hero-primary {
      background: var(--terra); color: var(--white);
      box-shadow: 0 4px 20px rgba(193,98,47,0.4);
    }
    .btn-hero-primary:hover {
      background: var(--terra2);
      box-shadow: 0 6px 28px rgba(193,98,47,0.55);
      transform: translateY(-1px);
    }
    .btn-hero-secondary {
      background: rgba(255,255,255,0.07);
      border: 1.5px solid rgba(255,255,255,0.18);
      color: rgba(250,246,240,0.85);
    }
    .btn-hero-secondary:hover { background: rgba(255,255,255,0.12); }

    /* ── SEARCH CARD ── */
    .search-section {
      position: relative; z-index: 2;
      padding: 40px 64px 80px;
      animation: fadeUp 0.9s 0.2s cubic-bezier(.4,0,.2,1) both;
    }
    .search-card {
      background: rgba(250,246,240,0.97);
      backdrop-filter: blur(20px);
      border-radius: 20px;
      padding: 28px 32px 32px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.35);
      max-width: 960px;
      border: 1px solid rgba(255,255,255,0.4);
    }
    .search-tabs {
      display: flex; gap: 4px; margin-bottom: 24px;
      background: var(--cream2); border-radius: 8px; padding: 4px; width: fit-content;
    }
    .tab-btn {
      padding: 6px 18px; border-radius: 6px; border: none;
      font-size: 0.82rem; font-weight: 500; cursor: pointer;
      font-family: var(--body); color: var(--muted);
      background: none; transition: all var(--transition);
    }
    .tab-btn.active {
      background: var(--white); color: var(--terra);
      box-shadow: 0 1px 6px rgba(0,0,0,0.10);
    }
    .search-grid {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr 1fr 100px 160px 160px;
      gap: 10px; align-items: end;
    }
    .search-grid.one-way {
      grid-template-columns: 1fr 1fr 1fr 100px 160px 160px;
    }
    @media (max-width: 960px) {
      .search-grid, .search-grid.one-way { grid-template-columns: 1fr 1fr; }
      .hero-content { padding: 140px 24px 0; }
      .search-section { padding: 32px 24px 60px; }
    }
    .search-field { display: flex; flex-direction: column; gap: 5px; }
    .search-label {
      font-size: 0.7rem; font-weight: 600; text-transform: uppercase;
      letter-spacing: 0.08em; color: var(--muted);
    }
    .search-input {
      padding: 11px 14px; border-radius: 9px;
      border: 1.5px solid var(--sand);
      font-size: 0.9rem; font-family: var(--body);
      color: var(--ink); background: var(--white);
      transition: border-color var(--transition), box-shadow var(--transition);
      outline: none; width: 100%;
    }
    .search-input:focus {
      border-color: var(--terra);
      box-shadow: 0 0 0 3px rgba(193,98,47,0.12);
    }
    select.search-input { cursor: pointer; }
    .search-btn {
      padding: 11px 20px; border-radius: 9px;
      background: var(--terra); color: var(--white);
      border: none; cursor: pointer;
      font-size: 0.88rem; font-weight: 600; font-family: var(--body);
      transition: all var(--transition);
      box-shadow: 0 3px 14px rgba(193,98,47,0.35);
      white-space: nowrap;
    }
    .search-btn:hover {
      background: var(--terra2); transform: translateY(-1px);
      box-shadow: 0 5px 20px rgba(193,98,47,0.45);
    }

    /* ── FEATURES ── */
    .features {
      background: var(--cream);
      padding: 100px 64px;
    }
    .features-inner { max-width: 1100px; margin: 0 auto; }
    .section-eyebrow {
      font-size: 0.72rem; font-weight: 700; letter-spacing: 0.14em;
      text-transform: uppercase; color: var(--terra); margin-bottom: 14px;
    }
    .section-title {
      font-family: var(--display); font-size: clamp(2rem, 4vw, 3rem);
      font-weight: 300; line-height: 1.15; color: var(--ink);
      margin-bottom: 56px; letter-spacing: -0.02em;
    }
    .features-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 28px; }
    @media (max-width: 768px) { .features-grid { grid-template-columns: 1fr; } }
    .feat-card {
      background: var(--white); border-radius: 18px;
      padding: 36px 32px;
      border: 1px solid var(--sand);
      transition: all var(--transition);
      cursor: default;
    }
    .feat-card:hover {
      transform: translateY(-4px);
      box-shadow: var(--shadow-lg);
      border-color: rgba(193,98,47,0.2);
    }
    .feat-icon { font-size: 2rem; margin-bottom: 18px; }
    .feat-title { font-size: 1.05rem; font-weight: 600; margin-bottom: 10px; color: var(--ink); }
    .feat-desc { font-size: 0.88rem; color: var(--muted); line-height: 1.7; font-weight: 300; }

    /* ── PAGE WRAPPER ── */
    .page { padding-top: 62px; min-height: 100vh; background: var(--cream); }

    /* ── RESULTS ── */
    .results-hero {
      background: linear-gradient(135deg, #1a0f0a 0%, #3d2515 100%);
      padding: 48px 64px 40px;
    }
    @media (max-width: 768px) { .results-hero { padding: 32px 20px 28px; } }
    .back-link {
      background: none; border: none; cursor: pointer;
      color: rgba(250,246,240,0.55); font-family: var(--body);
      font-size: 0.84rem; margin-bottom: 16px; display: block;
      transition: color var(--transition);
    }
    .back-link:hover { color: var(--terra2); }
    .results-title {
      font-family: var(--display); font-size: 2.4rem;
      font-weight: 300; color: var(--cream); letter-spacing: -0.02em;
      margin-bottom: 8px;
    }
    .results-sub { font-size: 0.84rem; color: rgba(250,246,240,0.55); font-weight: 300; }

    /* ── ROUND TRIP TABS ── */
    .trip-tabs {
      display: flex; gap: 2px; margin-bottom: 24px;
      background: var(--cream2); border-radius: 8px; padding: 3px; width: fit-content;
    }
    .trip-tab {
      padding: 7px 22px; border-radius: 6px; border: none;
      font-size: 0.82rem; font-weight: 600; cursor: pointer;
      font-family: var(--body); color: var(--muted);
      background: none; transition: all var(--transition);
    }
    .trip-tab.active {
      background: var(--terra); color: var(--white);
      box-shadow: 0 2px 8px rgba(193,98,47,0.3);
    }

    .results-body {
      display: grid; grid-template-columns: 260px 1fr;
      gap: 24px; padding: 32px 64px; max-width: 1200px; margin: 0 auto;
    }
    @media (max-width: 900px) {
      .results-body { grid-template-columns: 1fr; padding: 20px; }
    }

    .filter-card {
      background: var(--white); border-radius: var(--radius);
      padding: 24px; border: 1px solid var(--sand);
      height: fit-content; position: sticky; top: 80px;
    }
    .filter-title {
      font-family: var(--display); font-size: 1.1rem;
      font-weight: 600; margin-bottom: 20px; color: var(--ink);
    }
    .filter-section { margin-bottom: 20px; }
    .filter-label {
      font-size: 0.7rem; font-weight: 700; letter-spacing: 0.08em;
      text-transform: uppercase; color: var(--muted); margin-bottom: 10px;
    }
    .sort-select {
      width: 100%; padding: 9px 12px; border-radius: 8px;
      border: 1.5px solid var(--sand); font-family: var(--body);
      font-size: 0.84rem; color: var(--ink); background: var(--cream);
      cursor: pointer; outline: none; transition: border-color var(--transition);
    }
    .sort-select:focus { border-color: var(--terra); }
    .filter-option {
      display: flex; align-items: center; gap: 9px;
      font-size: 0.84rem; color: var(--ink2); cursor: pointer;
      margin-bottom: 8px; font-weight: 400;
    }
    .filter-option input[type=checkbox] {
      width: 16px; height: 16px; accent-color: var(--terra); cursor: pointer;
    }

    .flight-list { display: flex; flex-direction: column; gap: 14px; }

    /* ── ROUND TRIP LEG HEADER ── */
    .leg-header {
      display: flex; align-items: center; gap: 10px;
      padding: 10px 0 4px;
    }
    .leg-badge {
      padding: 4px 14px; border-radius: 50px;
      font-size: 0.72rem; font-weight: 700; letter-spacing: 0.06em;
      text-transform: uppercase;
    }
    .leg-badge.outbound { background: rgba(193,98,47,0.12); color: var(--terra); }
    .leg-badge.return   { background: rgba(76,175,80,0.12); color: #2e7d32; }
    .leg-line { flex: 1; height: 1px; background: var(--sand); }

    /* ── FLIGHT CARD ── */
    .flight-card {
      background: var(--white); border-radius: var(--radius);
      border: 1.5px solid var(--sand);
      overflow: hidden; cursor: pointer;
      transition: all var(--transition);
      position: relative;
    }
    .flight-card:hover {
      border-color: rgba(193,98,47,0.35);
      box-shadow: 0 8px 32px rgba(193,98,47,0.12);
      transform: translateY(-2px);
    }
    .flight-card.best {
      border-color: rgba(201,168,76,0.45);
      box-shadow: 0 0 0 1px rgba(201,168,76,0.2);
    }
    .best-tag {
      position: absolute; top: 0; right: 20px;
      background: linear-gradient(135deg, var(--gold), #e8c060);
      color: var(--brown); font-size: 0.68rem; font-weight: 700;
      letter-spacing: 0.06em; text-transform: uppercase;
      padding: 4px 12px; border-radius: 0 0 8px 8px;
    }
    .fc-main {
      display: grid; grid-template-columns: 200px 1fr auto;
      align-items: center; gap: 24px; padding: 20px 24px;
    }
    @media (max-width: 700px) {
      .fc-main { grid-template-columns: 1fr; gap: 16px; }
    }
    .airline-info { display: flex; align-items: center; gap: 12px; }
    .airline-logo {
      width: 44px; height: 44px; border-radius: 10px;
      background: var(--cream2); display: flex; align-items: center;
      justify-content: center; font-size: 1.3rem;
      border: 1px solid var(--sand); flex-shrink: 0;
    }
    .airline-name { font-size: 0.88rem; font-weight: 600; color: var(--ink); }
    .airline-no { font-size: 0.74rem; color: var(--muted); margin-top: 2px; }
    .route-viz {
      display: flex; align-items: center; justify-content: center;
      gap: 16px;
    }
    .route-end { text-align: center; min-width: 60px; }
    .route-iata {
      font-family: var(--display); font-size: 1.5rem; font-weight: 700;
      color: var(--ink); line-height: 1;
    }
    .route-city { font-size: 0.68rem; color: var(--muted); margin-top: 2px; font-weight: 300; }
    .route-time { font-size: 0.84rem; font-weight: 600; color: var(--ink2); margin-top: 4px; }
    .route-mid { text-align: center; flex: 1; }
    .route-dur { font-size: 0.72rem; color: var(--muted); margin-bottom: 6px; }
    .route-line {
      height: 1.5px; background: linear-gradient(90deg, var(--sand), var(--terra), var(--sand));
      border-radius: 2px; position: relative; margin: 0 8px;
    }
    .route-stops { font-size: 0.68rem; color: var(--muted); margin-top: 5px; }
    .price-block { text-align: right; }
    .price-val {
      font-family: var(--display); font-size: 1.6rem; font-weight: 700;
      color: var(--terra); line-height: 1;
    }
    .price-pp { font-size: 0.7rem; color: var(--muted); margin-top: 2px; }
    .select-btn {
      display: block; margin-top: 10px;
      padding: 9px 20px; border-radius: 8px;
      background: var(--terra); color: var(--white); border: none;
      cursor: pointer; font-size: 0.82rem; font-weight: 600;
      font-family: var(--body); transition: all var(--transition);
    }
    .select-btn:hover { background: var(--terra2); transform: translateX(2px); }
    .fc-tags {
      display: flex; flex-wrap: wrap; gap: 8px;
      padding: 10px 24px 16px; border-top: 1px solid var(--cream2);
    }
    .tag {
      font-size: 0.68rem; font-weight: 600; letter-spacing: 0.04em;
      padding: 3px 10px; border-radius: 50px;
    }
    .tag-green { background: #e8f5e9; color: #2e7d32; }
    .tag-warm  { background: #fff3e0; color: #e65100; }
    .tag-grey  { background: var(--cream2); color: var(--muted); }

    /* ── BOOKING PAGE ── */
    .detail-page {
      max-width: 1100px; margin: 0 auto;
      padding: 40px 64px 80px;
    }
    @media (max-width: 768px) { .detail-page { padding: 24px 20px 60px; } }
    .back-btn {
      background: none; border: none; cursor: pointer;
      font-family: var(--body); font-size: 0.84rem; color: var(--muted);
      margin-bottom: 28px; display: block;
      transition: color var(--transition);
    }
    .back-btn:hover { color: var(--terra); }
    .detail-grid {
      display: grid; grid-template-columns: 1fr 380px;
      gap: 28px; align-items: start;
    }
    @media (max-width: 900px) { .detail-grid { grid-template-columns: 1fr; } }
    .detail-card {
      background: var(--white); border-radius: var(--radius);
      padding: 28px; border: 1px solid var(--sand);
    }
    .detail-title {
      font-family: var(--display); font-size: 1.25rem; font-weight: 600;
      color: var(--ink); margin-bottom: 20px;
    }
    .detail-route {
      display: flex; align-items: center; justify-content: space-around;
      background: var(--cream); border-radius: 12px;
      padding: 20px; margin-bottom: 24px;
    }
    .dr-point { text-align: center; }
    .dr-iata {
      font-family: var(--display); font-size: 2rem; font-weight: 700;
      color: var(--ink); line-height: 1;
    }
    .dr-city { font-size: 0.72rem; color: var(--muted); margin-top: 3px; }
    .dr-time { font-size: 1rem; font-weight: 600; color: var(--terra); margin-top: 6px; }
    .dr-mid { text-align: center; flex: 1; padding: 0 16px; }
    .dr-dur { font-size: 0.78rem; color: var(--muted); margin-bottom: 8px; }
    .dr-plane { font-size: 1.4rem; }
    .detail-info-grid {
      display: grid; grid-template-columns: 1fr 1fr;
      gap: 12px;
    }
    .info-item {
      background: var(--cream); border-radius: 8px;
      padding: 10px 14px;
    }
    .info-key { font-size: 0.68rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; color: var(--muted); margin-bottom: 3px; }
    .info-val { font-size: 0.88rem; font-weight: 500; color: var(--ink2); }
    .pax-form {
      display: grid; grid-template-columns: 1fr 1fr; gap: 14px;
    }
    .form-group { display: flex; flex-direction: column; gap: 5px; }
    .form-label { font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.07em; color: var(--muted); }
    .form-input {
      padding: 10px 13px; border-radius: 9px;
      border: 1.5px solid var(--sand); font-family: var(--body);
      font-size: 0.88rem; color: var(--ink); background: var(--white);
      outline: none; transition: border-color var(--transition), box-shadow var(--transition);
    }
    .form-input:focus {
      border-color: var(--terra);
      box-shadow: 0 0 0 3px rgba(193,98,47,0.10);
    }

    /* ── PAYMENT SECTION ── */
    .payment-section {
      background: var(--white); border-radius: var(--radius);
      padding: 28px; border: 1px solid var(--sand); margin-top: 20px;
    }
    .payment-methods {
      display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 20px;
    }
    .payment-method-btn {
      padding: 14px 16px; border-radius: 10px;
      border: 2px solid var(--sand); background: var(--cream);
      cursor: pointer; font-family: var(--body); font-size: 0.84rem;
      font-weight: 500; color: var(--ink2); transition: all var(--transition);
      display: flex; align-items: center; gap: 10px;
    }
    .payment-method-btn:hover { border-color: var(--terra); }
    .payment-method-btn.active {
      border-color: var(--terra); background: rgba(193,98,47,0.06);
      color: var(--terra);
    }
    .payment-method-icon { font-size: 1.2rem; }
    .razorpay-badge {
      display: flex; align-items: center; gap: 6px;
      font-size: 0.72rem; color: var(--muted); margin-top: 12px;
      justify-content: center;
    }
    .secure-badge {
      display: flex; align-items: center; gap: 6px;
      background: #e8f5e9; border-radius: 6px; padding: 8px 12px;
      font-size: 0.75rem; color: #2e7d32; font-weight: 500;
      margin-bottom: 16px;
    }

    /* ── SUMMARY CARD ── */
    .summary-card {
      background: var(--white); border-radius: var(--radius);
      padding: 28px; border: 1px solid var(--sand);
      position: sticky; top: 80px;
    }
    .summary-title {
      font-family: var(--display); font-size: 1.2rem;
      font-weight: 600; color: var(--ink); margin-bottom: 20px;
    }
    .sum-airline {
      display: flex; align-items: center; gap: 12px;
      padding-bottom: 16px; margin-bottom: 16px;
      border-bottom: 1px solid var(--cream2);
    }
    .sum-route { margin-bottom: 16px; }
    .sum-row {
      display: flex; justify-content: space-between; align-items: center;
      padding: 7px 0; border-bottom: 1px solid var(--cream2);
    }
    .sum-key { font-size: 0.78rem; color: var(--muted); font-weight: 400; }
    .sum-val { font-size: 0.84rem; font-weight: 500; color: var(--ink2); }
    .sum-total {
      display: flex; justify-content: space-between; align-items: center;
      padding: 16px 0 0; margin-top: 4px;
    }
    .sum-total-key { font-size: 0.88rem; font-weight: 700; color: var(--ink); }
    .sum-total-val {
      font-family: var(--display); font-size: 1.6rem;
      font-weight: 700; color: var(--terra);
    }
    .book-btn {
      width: 100%; padding: 14px;
      background: var(--terra); color: var(--white); border: none;
      border-radius: 10px; cursor: pointer;
      font-size: 0.92rem; font-weight: 700; font-family: var(--body);
      margin-top: 18px; transition: all var(--transition);
      box-shadow: 0 4px 16px rgba(193,98,47,0.3);
    }
    .book-btn:hover:not(:disabled) {
      background: var(--terra2); transform: translateY(-1px);
      box-shadow: 0 6px 24px rgba(193,98,47,0.4);
    }
    .book-btn:disabled { opacity: 0.4; cursor: not-allowed; transform: none; }
    .guest-note {
      text-align: center; font-size: 0.74rem; color: var(--muted);
      margin-top: 10px; line-height: 1.5;
    }

    /* ── CONFIRM PAGE ── */
    .confirm-page {
      max-width: 600px; margin: 0 auto;
      padding: 80px 24px 120px; text-align: center;
    }
    .confirm-icon { font-size: 4rem; margin-bottom: 20px; animation: pop 0.5s cubic-bezier(.34,1.56,.64,1); }
    @keyframes pop { from { transform: scale(0); } to { transform: scale(1); } }
    .confirm-title {
      font-family: var(--display); font-size: 2.4rem; font-weight: 300;
      color: var(--ink); margin-bottom: 12px; letter-spacing: -0.02em;
    }
    .confirm-sub { font-size: 0.92rem; color: var(--muted); line-height: 1.7; margin-bottom: 36px; font-weight: 300; }
    .confirm-card {
      background: var(--white); border-radius: var(--radius);
      padding: 28px; border: 1px solid var(--sand); text-align: left;
      margin-bottom: 32px;
    }
    .booking-label { font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: var(--muted); margin-bottom: 6px; }
    .booking-id {
      font-family: var(--display); font-size: 2rem; font-weight: 700;
      color: var(--terra); letter-spacing: 0.04em; margin-bottom: 4px;
    }

    /* ── AUTH MODAL ── */
    .overlay {
      position: fixed; inset: 0; z-index: 200;
      background: rgba(15,14,12,0.65);
      backdrop-filter: blur(8px);
      display: flex; align-items: center; justify-content: center;
      animation: fadeIn 0.2s ease;
    }
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
    .modal {
      background: var(--white); border-radius: 20px;
      padding: 48px 40px; width: 400px; max-width: 95vw;
      box-shadow: var(--shadow-lg);
      animation: slideUp 0.3s cubic-bezier(.4,0,.2,1);
      text-align: center; position: relative;
    }
    @keyframes slideUp { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: translateY(0); } }
    .modal-close {
      position: absolute; top: 16px; right: 16px;
      background: var(--cream2); border: none; cursor: pointer;
      width: 30px; height: 30px; border-radius: 50%;
      font-size: 0.8rem; color: var(--muted);
      transition: all var(--transition);
    }
    .modal-close:hover { background: var(--sand); color: var(--ink); }
    .modal-plane { font-size: 2.5rem; margin-bottom: 16px; }
    .modal-title { font-family: var(--display); font-size: 1.8rem; font-weight: 600; margin-bottom: 8px; }
    .modal-sub { font-size: 0.84rem; color: var(--muted); line-height: 1.6; margin-bottom: 32px; font-weight: 300; }
    .google-btn {
      width: 100%; padding: 13px 20px;
      display: flex; align-items: center; justify-content: center; gap: 12px;
      background: var(--white); border: 1.5px solid var(--sand);
      border-radius: 10px; cursor: pointer;
      font-family: var(--body); font-size: 0.9rem; font-weight: 500;
      color: var(--ink); margin-bottom: 20px;
      transition: all var(--transition);
    }
    .google-btn:hover { border-color: var(--terra); box-shadow: var(--shadow); }
    .google-btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .google-icon { width: 20px; height: 20px; }

    /* ── AI CHAT (SkyBook AI) ── */
    .ai-fab {
      position: fixed; bottom: 28px; right: 28px; z-index: 150;
    }
    .ai-toggle {
      width: 56px; height: 56px; border-radius: 50%;
      background: #1a0f0a;
      border: none; cursor: pointer; font-size: 1.3rem;
      color: var(--white); box-shadow: 0 4px 20px rgba(0,0,0,0.35);
      transition: all var(--transition);
      display: flex; align-items: center; justify-content: center;
    }
    .ai-toggle:hover { transform: scale(1.06); box-shadow: 0 6px 28px rgba(0,0,0,0.45); }
    .ai-chat-box {
      position: absolute; bottom: 72px; right: 0;
      width: 420px; background: var(--white);
      border-radius: 20px; border: 0.5px solid var(--sand);
      box-shadow: 0 20px 60px rgba(0,0,0,0.15);
      overflow: hidden;
      animation: slideUp 0.25s cubic-bezier(.4,0,.2,1);
    }
    .ai-chat-header {
      display: flex; align-items: center; gap: 10px;
      padding: 13px 15px;
      background: #1a1410;
      border-bottom: 1px solid rgba(255,255,255,0.06);
    }
    .ai-dot {
      width: 8px; height: 8px; border-radius: 50%;
      background: #4caf50; flex-shrink: 0;
      animation: pulse-dot 2s ease infinite;
    }
    @keyframes pulse-dot {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.6; transform: scale(0.85); }
    }
    .ai-header-name {
      font-size: 0.84rem; font-weight: 600; color: #fff;
    }
    .ai-header-sub { font-size: 0.68rem; color: rgba(255,255,255,0.38); margin-top: 1px; }
    .ai-close-btn {
      background: rgba(255,255,255,0.08); border: none; cursor: pointer;
      color: rgba(255,255,255,0.5); font-size: 0.82rem;
      width: 26px; height: 26px; border-radius: 6px;
      display: flex; align-items: center; justify-content: center;
      transition: all var(--transition); flex-shrink: 0;
    }
    .ai-close-btn:hover { background: rgba(255,255,255,0.15); color: #fff; }
    .ai-messages {
      height: 340px; overflow-y: auto;
      padding: 14px; display: flex; flex-direction: column; gap: 10px;
      background: #f7f3ef;
    }
    .ai-messages::-webkit-scrollbar { width: 3px; }
    .ai-messages::-webkit-scrollbar-track { background: transparent; }
    .ai-messages::-webkit-scrollbar-thumb { background: var(--sand); border-radius: 2px; }
    .ai-msg {
      max-width: 85%; padding: 10px 13px;
      font-size: 0.82rem; line-height: 1.6;
      white-space: pre-line; word-break: break-word;
      animation: msgIn 0.2s ease;
    }
    @keyframes msgIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
    .ai-msg.bot {
      background: var(--white); color: var(--ink2);
      border: 0.5px solid var(--sand);
      border-radius: 16px; border-bottom-left-radius: 4px;
      align-self: flex-start;
    }
    .ai-msg.user {
      background: #c1622f;
      color: var(--white);
      border-radius: 16px; border-bottom-right-radius: 4px;
      align-self: flex-end;
    }
    .ai-typing {
      display: flex; gap: 4px; align-items: center;
      padding: 10px 14px; background: var(--white);
      border: 0.5px solid var(--sand);
      border-radius: 16px; border-bottom-left-radius: 4px;
      align-self: flex-start; width: fit-content;
    }
    .ai-typing span {
      width: 6px; height: 6px; border-radius: 50%;
      background: var(--muted); animation: bounce 1.2s ease infinite;
    }
    .ai-typing span:nth-child(2) { animation-delay: 0.2s; }
    .ai-typing span:nth-child(3) { animation-delay: 0.4s; }
    @keyframes bounce {
      0%, 60%, 100% { transform: translateY(0); }
      30% { transform: translateY(-6px); }
    }
    .ai-quick-replies {
      display: flex; flex-wrap: wrap; gap: 5px;
      padding: 10px 14px; background: var(--white);
      border-top: 0.5px solid var(--sand);
    }
    .quick-reply {
      padding: 5px 11px; border-radius: 50px;
      background: #f7f3ef; border: 0.5px solid var(--sand);
      font-size: 0.71rem; font-family: var(--body); cursor: pointer;
      color: var(--ink2); font-weight: 500;
      transition: all var(--transition);
    }
    .quick-reply:hover { border-color: var(--terra); color: var(--terra); background: rgba(193,98,47,0.05); }
    .ai-input-row {
      display: flex; gap: 8px; padding: 11px 13px;
      background: var(--white); border-top: 0.5px solid var(--sand);
      align-items: center;
    }
    .ai-input {
      flex: 1; padding: 9px 13px; border-radius: 22px;
      border: 0.5px solid var(--sand); font-family: var(--body);
      font-size: 0.82rem; color: var(--ink); outline: none;
      transition: border-color var(--transition);
      background: #f7f3ef;
    }
    .ai-input:focus { border-color: var(--terra); background: var(--white); }
    .ai-send {
      width: 36px; height: 36px; border-radius: 50%;
      background: #c1622f; color: var(--white); border: none;
      cursor: pointer; transition: all var(--transition); flex-shrink: 0;
      display: flex; align-items: center; justify-content: center;
    }
    .ai-send:hover { background: #a5521f; transform: scale(1.05); }
    .ai-send:disabled { opacity: 0.35; cursor: not-allowed; transform: none; }

    /* ── PRICE PREDICTOR AGENT ── */
    .price-fab {
      position: fixed; bottom: 28px; right: 100px; z-index: 150;
    }
    .price-toggle {
      width: 58px; height: 58px; border-radius: 50%;
      background: linear-gradient(135deg, #1a6b3c, #0d4a27);
      border: none; cursor: pointer; font-size: 1.3rem;
      color: var(--white); box-shadow: 0 6px 24px rgba(26,107,60,0.5);
      transition: all var(--transition);
      display: flex; align-items: center; justify-content: center;
    }
    .price-toggle:hover { transform: scale(1.08); box-shadow: 0 8px 32px rgba(26,107,60,0.6); }
    .price-panel {
      position: absolute; bottom: 72px; right: 0;
      width: 380px; background: var(--white);
      border-radius: 18px; border: 1px solid var(--sand);
      box-shadow: 0 16px 60px rgba(0,0,0,0.18);
      overflow: hidden;
      animation: slideUp 0.25s cubic-bezier(.4,0,.2,1);
    }
    .price-panel-header {
      display: flex; align-items: center; gap: 9px;
      padding: 14px 18px;
      background: linear-gradient(135deg, #0d2e1a, #1a6b3c);
      border-bottom: 1px solid rgba(255,255,255,0.06);
    }
    .price-dot {
      width: 8px; height: 8px; border-radius: 50%;
      background: #ffd700; box-shadow: 0 0 6px rgba(255,215,0,0.6);
      animation: pulse-dot 2s ease infinite;
    }
    .price-header-name {
      font-size: 0.84rem; font-weight: 600; color: var(--cream); flex: 1;
    }
    .price-header-sub { font-size: 0.68rem; color: rgba(250,246,240,0.5); }
    .price-body {
      padding: 20px;
    }
    .price-form { display: flex; flex-direction: column; gap: 12px; margin-bottom: 16px; }
    .price-field { display: flex; flex-direction: column; gap: 4px; }
    .price-label { font-size: 0.68rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: var(--muted); }
    .price-input {
      padding: 9px 12px; border-radius: 8px;
      border: 1.5px solid var(--sand); font-family: var(--body);
      font-size: 0.84rem; color: var(--ink); background: var(--cream);
      outline: none; transition: border-color var(--transition);
    }
    .price-input:focus { border-color: #1a6b3c; background: var(--white); }
    .price-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    .analyze-btn {
      width: 100%; padding: 11px; border-radius: 9px;
      background: linear-gradient(135deg, #1a6b3c, #0d4a27);
      color: var(--white); border: none; cursor: pointer;
      font-size: 0.88rem; font-weight: 700; font-family: var(--body);
      transition: all var(--transition);
      box-shadow: 0 3px 14px rgba(26,107,60,0.35);
    }
    .analyze-btn:hover:not(:disabled) {
      transform: translateY(-1px);
      box-shadow: 0 5px 20px rgba(26,107,60,0.45);
    }
    .analyze-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
    .prediction-result {
      background: var(--cream); border-radius: 12px;
      padding: 16px; margin-top: 14px;
      border: 1px solid var(--sand);
      animation: msgIn 0.3s ease;
    }
    .prediction-result .pred-label {
      font-size: 0.68rem; font-weight: 700; text-transform: uppercase;
      letter-spacing: 0.08em; color: var(--muted); margin-bottom: 8px;
    }
    .pred-verdict {
      font-size: 1rem; font-weight: 700; margin-bottom: 8px;
      display: flex; align-items: center; gap: 8px;
    }
    .pred-verdict.buy { color: #1a6b3c; }
    .pred-verdict.wait { color: #b45309; }
    .pred-verdict.neutral { color: var(--muted); }
    .pred-text {
      font-size: 0.8rem; color: var(--ink2); line-height: 1.6; font-weight: 300;
    }
    .pred-confidence {
      margin-top: 10px; display: flex; align-items: center; gap: 8px;
    }
    .pred-conf-bar {
      flex: 1; height: 5px; background: var(--sand); border-radius: 3px; overflow: hidden;
    }
    .pred-conf-fill {
      height: 100%; border-radius: 3px;
      background: linear-gradient(90deg, #1a6b3c, #4caf50);
      transition: width 0.6s ease;
    }
    .pred-conf-label { font-size: 0.7rem; color: var(--muted); white-space: nowrap; }
    .pred-loading {
      display: flex; align-items: center; justify-content: center; gap: 8px;
      padding: 20px; color: var(--muted); font-size: 0.84rem;
    }
    .pred-spinner {
      width: 18px; height: 18px; border-radius: 50%;
      border: 2px solid var(--sand); border-top-color: #1a6b3c;
      animation: spin 0.7s linear infinite;
    }

    /* ── LOADING SKELETON ── */
    .skeleton {
      background: linear-gradient(90deg, var(--cream2) 25%, var(--sand) 50%, var(--cream2) 75%);
      background-size: 200% 100%;
      animation: shimmer 1.4s ease infinite;
      border-radius: 8px;
    }
    @keyframes shimmer { from { background-position: 200% 0; } to { background-position: -200% 0; } }
    .skeleton-card {
      background: var(--white); border-radius: var(--radius);
      padding: 24px; border: 1px solid var(--sand);
    }

    /* ── EMPTY / ERROR STATES ── */
    .state-box {
      background: var(--white); border-radius: var(--radius);
      border: 1px solid var(--sand); padding: 56px 32px;
      text-align: center;
    }
    .state-icon { font-size: 3rem; margin-bottom: 16px; }
    .state-title { font-family: var(--display); font-size: 1.4rem; font-weight: 600; color: var(--ink); margin-bottom: 8px; }
    .state-desc { font-size: 0.88rem; color: var(--muted); line-height: 1.7; font-weight: 300; }

    /* ── AUTH LOADING ── */
    .auth-loading {
      display: flex; align-items: center; justify-content: center; gap: 10px;
      padding: 14px; color: var(--muted); font-size: 0.84rem;
    }
    .spinner {
      width: 18px; height: 18px; border-radius: 50%;
      border: 2px solid var(--sand);
      border-top-color: var(--terra);
      animation: spin 0.7s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    /* ── ERROR BANNER ── */
    .error-banner {
      background: #fff3f3; border: 1.5px solid #ffcdd2; border-radius: 10px;
      padding: 12px 16px; font-size: 0.84rem; color: #c62828;
      margin-bottom: 16px; display: flex; align-items: center; gap: 8px;
    }
  `}</style>
);
// ── DATA ──────────────────────────────────────────────────────────────────
const CITY_MAP = {
  BOM:"Mumbai",DEL:"Delhi",BLR:"Bangalore",MAA:"Chennai",HYD:"Hyderabad",CCU:"Kolkata",COK:"Kochi",
  AMD:"Ahmedabad",GOI:"Goa",PNQ:"Pune",ATQ:"Amritsar",JAI:"Jaipur",LKO:"Lucknow",IXC:"Chandigarh",
  TRV:"Trivandrum",IXM:"Madurai",IXB:"Bagdogra",PAT:"Patna",BBI:"Bhubaneswar",VNS:"Varanasi",
  DXB:"Dubai",AUH:"Abu Dhabi",SHJ:"Sharjah",DOH:"Doha",KWI:"Kuwait",MCT:"Muscat",
  RUH:"Riyadh",JED:"Jeddah",BAH:"Bahrain",
  LHR:"London",LGW:"London Gatwick",MAN:"Manchester",CDG:"Paris",FRA:"Frankfurt",
  AMS:"Amsterdam",MAD:"Madrid",BCN:"Barcelona",FCO:"Rome",ZRH:"Zurich",
  VIE:"Vienna",IST:"Istanbul",DUB:"Dublin",
  JFK:"New York",LGA:"New York LGA",EWR:"Newark",LAX:"Los Angeles",SFO:"San Francisco",
  ORD:"Chicago",ATL:"Atlanta",DFW:"Dallas",SEA:"Seattle",MIA:"Miami",BOS:"Boston",
  IAH:"Houston",DEN:"Denver",PHX:"Phoenix",LAS:"Las Vegas",MCO:"Orlando",
  YYZ:"Toronto",YVR:"Vancouver",YUL:"Montreal",
  SIN:"Singapore",KUL:"Kuala Lumpur",BKK:"Bangkok",HKG:"Hong Kong",
  ICN:"Seoul",NRT:"Tokyo",HND:"Tokyo Haneda",PEK:"Beijing",PVG:"Shanghai",
  DPS:"Bali",CGK:"Jakarta",MNL:"Manila",
  SYD:"Sydney",MEL:"Melbourne",BNE:"Brisbane",PER:"Perth",AKL:"Auckland"
};

const QUICK_REPLIES = [
  "Flights from Delhi to Dubai tomorrow",
  "Cheapest Mumbai to London?",
  "Business class Bangalore to NYC",
  "What's the baggage allowance?",
  "How do I cancel my booking?",
];

// ── PAYMENT STYLES ────────────────────────────────────────────────────────
const PAYMENT_STYLES = `
@import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=DM+Sans:wght@300;400;500;600&display=swap');

/* ── Payment Section ── */
.ps-root { margin-top: 28px; }

.ps-heading {
  font-family: 'Syne', sans-serif;
  font-size: 1.05rem;
  font-weight: 700;
  color: var(--ink, #1c1208);
  letter-spacing: -0.01em;
  margin: 0 0 14px;
  display: flex;
  align-items: center;
  gap: 10px;
}
.ps-heading::after {
  content: '';
  flex: 1;
  height: 1px;
  background: linear-gradient(to right, rgba(193,98,47,0.25), transparent);
}

.ps-security {
  display: flex;
  align-items: center;
  gap: 8px;
  background: linear-gradient(135deg, rgba(193,68,14,0.06) 0%, rgba(193,98,47,0.04) 100%);
  border: 1px solid rgba(193,68,14,0.14);
  border-radius: 10px;
  padding: 10px 14px;
  margin-bottom: 18px;
}
.ps-security-icon { font-size: 1rem; flex-shrink: 0; }
.ps-security-text {
  font-family: 'DM Sans', sans-serif;
  font-size: 0.72rem;
  color: var(--brown, #7a4820);
  line-height: 1.4;
}
.ps-security-text strong { font-weight: 600; }

.ps-method-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-bottom: 18px;
}

.ps-method-btn {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 5px;
  padding: 14px 16px;
  border-radius: 14px;
  border: 1.5px solid rgba(28,18,8,0.1);
  background: #fff;
  cursor: pointer;
  transition: all 0.2s ease;
  text-align: left;
  font-family: 'DM Sans', sans-serif;
}
.ps-method-btn:hover {
  border-color: rgba(193,68,14,0.35);
  background: rgba(193,68,14,0.02);
  transform: translateY(-1px);
  box-shadow: 0 4px 16px rgba(193,68,14,0.1);
}
.ps-method-btn.active {
  border-color: #c1440e;
  background: rgba(193,68,14,0.04);
  box-shadow: 0 0 0 3px rgba(193,68,14,0.1);
}
.ps-method-btn.active::before {
  content: '✓';
  position: absolute;
  top: 10px;
  right: 12px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #c1440e;
  color: #fff;
  font-size: 0.62rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
}
.ps-method-emoji { font-size: 1.4rem; line-height: 1; }
.ps-method-label {
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--ink, #1c1208);
  line-height: 1.2;
}
.ps-method-sub {
  font-size: 0.66rem;
  color: var(--muted, #8a7560);
  line-height: 1.3;
  font-weight: 400;
}

.ps-rzp-brand {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 11px;
  border-radius: 10px;
  background: #f7f4f0;
  border: 1px solid rgba(28,18,8,0.07);
  margin-bottom: 4px;
}
.ps-rzp-brand-text {
  font-family: 'DM Sans', sans-serif;
  font-size: 0.69rem;
  color: var(--muted, #8a7560);
  line-height: 1.4;
}
.ps-rzp-logo { display: flex; align-items: center; gap: 5px; }
.ps-rzp-logo-mark {
  width: 22px; height: 22px; border-radius: 5px;
  background: #072654; display: flex; align-items: center;
  justify-content: center; flex-shrink: 0;
}
.ps-rzp-logo-wordmark {
  font-size: 0.72rem; font-weight: 700; color: #072654;
  letter-spacing: -0.01em; font-family: 'Syne', sans-serif;
}

/* ── Summary Card ── */
.bsc-root { position: sticky; top: 100px; }

.bsc-card {
  background: #fff;
  border-radius: 20px;
  border: 1.5px solid rgba(28,18,8,0.09);
  overflow: hidden;
  box-shadow: 0 4px 32px rgba(28,18,8,0.06);
}

.bsc-airline-band {
  background: linear-gradient(135deg, #1c1208 0%, #3d2510 100%);
  padding: 20px 22px;
  display: flex;
  align-items: center;
  gap: 14px;
}
.bsc-airline-icon {
  width: 44px; height: 44px; border-radius: 12px;
  background: rgba(255,255,255,0.1);
  border: 1px solid rgba(255,255,255,0.15);
  display: flex; align-items: center; justify-content: center;
  font-size: 1.3rem; flex-shrink: 0;
}
.bsc-airline-name {
  font-family: 'Syne', sans-serif; font-size: 0.9rem;
  font-weight: 700; color: #fff; margin-bottom: 2px;
}
.bsc-airline-type {
  font-family: 'DM Sans', sans-serif; font-size: 0.7rem;
  color: rgba(255,255,255,0.55); font-weight: 400;
}

.bsc-route { padding: 20px 22px 0; }
.bsc-route-cities {
  display: flex; align-items: center;
  justify-content: space-between; margin-bottom: 14px;
}
.bsc-city-block { text-align: center; }
.bsc-iata {
  font-family: 'Syne', sans-serif; font-size: 2rem;
  font-weight: 800; color: var(--ink, #1c1208);
  letter-spacing: -0.04em; line-height: 1; margin-bottom: 3px;
}
.bsc-city {
  font-family: 'DM Sans', sans-serif; font-size: 0.68rem;
  color: var(--muted, #8a7560); font-weight: 400;
}
.bsc-flight-line {
  flex: 1; display: flex; flex-direction: column;
  align-items: center; gap: 4px; margin: 0 12px;
}
.bsc-duration {
  font-family: 'DM Sans', sans-serif; font-size: 0.68rem;
  color: var(--muted, #8a7560); font-weight: 500;
}
.bsc-line-track {
  width: 100%; display: flex; align-items: center; gap: 4px;
}
.bsc-line-dot {
  width: 6px; height: 6px; border-radius: 50%;
  border: 2px solid #c1440e; flex-shrink: 0;
}
.bsc-line-dashes {
  flex: 1; height: 1.5px;
  background: repeating-linear-gradient(
    to right, #c1440e 0, #c1440e 4px, transparent 4px, transparent 10px
  );
}
.bsc-plane-icon { font-size: 0.9rem; color: #c1440e; flex-shrink: 0; }
.bsc-stops {
  font-family: 'DM Sans', sans-serif; font-size: 0.62rem; color: var(--muted, #8a7560);
}

.bsc-details { padding: 0 22px 14px; }
.bsc-detail-row {
  display: flex; justify-content: space-between; align-items: center;
  padding: 6px 0; border-bottom: 1px solid rgba(28,18,8,0.05);
  font-family: 'DM Sans', sans-serif; font-size: 0.78rem;
}
.bsc-detail-row:last-child { border-bottom: none; }
.bsc-detail-key { color: var(--muted, #8a7560); font-weight: 400; }
.bsc-detail-val { color: var(--ink, #1c1208); font-weight: 500; }

.bsc-fare {
  margin: 0 14px; background: #f9f6f2;
  border-radius: 12px; padding: 14px 16px;
}
.bsc-fare-row {
  display: flex; justify-content: space-between; align-items: center;
  padding: 5px 0; font-family: 'DM Sans', sans-serif; font-size: 0.76rem;
}
.bsc-fare-key { color: var(--muted, #8a7560); }
.bsc-fare-val { color: var(--ink, #1c1208); font-weight: 500; }
.bsc-fare-divider { height: 1px; background: rgba(28,18,8,0.08); margin: 8px 0; }
.bsc-total-row {
  display: flex; justify-content: space-between; align-items: center; padding: 4px 0;
}
.bsc-total-key {
  font-family: 'Syne', sans-serif; font-size: 0.88rem;
  font-weight: 700; color: var(--ink, #1c1208);
}
.bsc-total-val {
  font-family: 'Syne', sans-serif; font-size: 1.4rem;
  font-weight: 800; color: #c1440e; letter-spacing: -0.03em;
}

.bsc-footer { padding: 16px 22px 22px; }

/* Pay button */
.ps-pay-btn {
  position: relative; width: 100%; padding: 16px 24px;
  border-radius: 14px; border: none;
  background: linear-gradient(135deg, #c1440e 0%, #e07336 100%);
  color: #fff; font-family: 'Syne', sans-serif;
  font-size: 1rem; font-weight: 700; letter-spacing: -0.01em;
  cursor: pointer; transition: all 0.25s ease;
  overflow: hidden; margin-top: 18px;
}
.ps-pay-btn::before {
  content: '';
  position: absolute; inset: 0;
  background: linear-gradient(135deg, rgba(255,255,255,0.12) 0%, transparent 60%);
  border-radius: inherit;
}
.ps-pay-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 8px 28px rgba(193,68,14,0.38);
}
.ps-pay-btn:active:not(:disabled) { transform: translateY(0); }
.ps-pay-btn:disabled { opacity: 0.7; cursor: not-allowed; }
.ps-pay-btn-inner {
  display: flex; align-items: center; justify-content: center; gap: 10px;
}
.ps-pay-spinner {
  width: 18px; height: 18px;
  border: 2.5px solid rgba(255,255,255,0.35);
  border-top-color: #fff; border-radius: 50%;
  animation: ps-spin 0.7s linear infinite;
}
@keyframes ps-spin { to { transform: rotate(360deg); } }

@keyframes ps-shimmer {
  0% { transform: translateX(-100%) skewX(-15deg); }
  100% { transform: translateX(300%) skewX(-15deg); }
}
.ps-pay-btn:not(:disabled)::after {
  content: ''; position: absolute; top: 0; left: 0;
  width: 35%; height: 100%;
  background: linear-gradient(to right, transparent, rgba(255,255,255,0.15), transparent);
  animation: ps-shimmer 2.5s ease-in-out infinite;
}

.bsc-secure-note {
  text-align: center; font-family: 'DM Sans', sans-serif;
  font-size: 0.67rem; color: var(--muted, #8a7560); margin-top: 12px;
  display: flex; align-items: center; justify-content: center; gap: 5px;
}
.bsc-guest-note {
  text-align: center; margin-top: 12px;
  font-family: 'DM Sans', sans-serif; font-size: 0.72rem;
  color: var(--muted, #8a7560); background: rgba(193,68,14,0.05);
  border-radius: 8px; padding: 10px;
  border: 1px solid rgba(193,68,14,0.12);
}
.ps-trust-row {
  display: flex; justify-content: center; gap: 20px; margin-top: 14px;
}
.ps-trust-badge {
  display: flex; flex-direction: column; align-items: center; gap: 3px;
}
.ps-trust-icon { font-size: 1rem; }
.ps-trust-text {
  font-family: 'DM Sans', sans-serif; font-size: 0.6rem;
  color: var(--muted, #8a7560); text-align: center;
  line-height: 1.3; font-weight: 500; white-space: pre-line;
}
`;

function injectPaymentStyles() {
  if (document.getElementById("skybook-payment-styles")) return;
  const style = document.createElement("style");
  style.id = "skybook-payment-styles";
  style.textContent = PAYMENT_STYLES;
  document.head.appendChild(style);
}

// ── API HELPERS ───────────────────────────────────────────────────────────
async function askPricePredictor(route, date, cabin, currentPrice) {
  try {
    const [from, to] = route.split(" → ");
    const res = await fetch(`${API_BASE}/ai/predict-price`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ from_city: from, to_city: to, date, cabin, price: currentPrice })
    });
    if (!res.ok) throw new Error("Prediction failed");
    return await res.json();
  } catch (e) {
    return {
      verdict: "NEUTRAL", confidence: 60,
      summary: "Prediction unavailable right now.",
      reasoning: "Could not contact prediction server.",
      best_booking_window: "2–3 weeks before departure",
      price_trend: "STABLE"
    };
  }
}

async function fetchFlights(fromCity, toCity, date, pax = 1, cabin = "economy") {
  const params = new URLSearchParams({ from_city: fromCity, to_city: toCity, date, pax, cabin });
  const res = await fetch(`${API_BASE}/flights/search?${params}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "No flights found");
  }
  return res.json();
}

async function askAI(messages) {
  try {
    const res = await fetch(`${API_BASE}/ai/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages }),
    });
    if (!res.ok) throw new Error("AI error");
    const data = await res.json();
    return data.reply || "Sorry, I couldn't get a response.";
  } catch (e) {
    return "⚠️ AI service temporarily unavailable. Please try again shortly.";
  }
}

async function verifyGoogleToken(credential) {
  const res = await fetch(`${API_BASE}/auth/google`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ credential }),
  });
  if (!res.ok) throw new Error("Google auth failed");
  return res.json();
}

async function createRazorpayOrder(amount, currency = "INR", receipt = "") {
  const res = await fetch(`${API_BASE}/payment/create-order`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ amount, currency, receipt }),
  });
  if (!res.ok) throw new Error("Could not create payment order");
  return res.json();
}

async function verifyRazorpayPayment(data) {
  const res = await fetch(`${API_BASE}/payment/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Payment verification failed");
  return res.json();
}

async function confirmBooking(offerId, passenger, flight, paymentId) {
  const res = await fetch(`${API_BASE}/booking`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ offer_id: offerId, passenger, flight, payment_id: paymentId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Booking failed");
  }
  return res.json();
}

// ── UTILS ─────────────────────────────────────────────────────────────────
function fmtTime(raw) {
  if (!raw) return "N/A";
  if (raw.includes("T")) return raw.split("T")[1]?.slice(0, 5);
  return raw.slice(11, 16) || raw;
}
function fmtDate(raw) {
  if (!raw) return "";
  return raw.slice(0, 10);
}

function loadRazorpay() {
  return new Promise((resolve) => {
    if (window.Razorpay) { resolve(true); return; }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

function loadGoogleGIS() {
  return new Promise((resolve) => {
    if (window.google?.accounts) { resolve(true); return; }
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

// ── PAYMENT SUB-COMPONENTS ────────────────────────────────────────────────
function RazorpayLogoMark() {
  return (
    <svg width="14" height="14" viewBox="0 0 245 245" fill="none">
      <rect width="245" height="245" rx="6" fill="#072654"/>
      <path d="M196.7 74.6L142.4 170H98.1l18.7-33.4-35.5-62H126l16.4 30.2 26.4-30.2h27.9z" fill="#3395FF"/>
    </svg>
  );
}

const PAYMENT_METHODS = [
  { id: "razorpay", emoji: "💳", label: "Cards",       sub: "Visa · Mastercard · Amex · RuPay" },
  { id: "upi",      emoji: "📱", label: "UPI",         sub: "GPay · PhonePe · BHIM · Paytm" },
  { id: "netbank",  emoji: "🏦", label: "Net Banking", sub: "50+ banks supported" },
  { id: "emi",      emoji: "📅", label: "EMI",         sub: "No-cost EMI available" },
];

// ── PAYMENT SECTION (replaces old payment-section div) ────────────────────
function PaymentSection({ paymentMethod, setPaymentMethod, user }) {
  useEffect(() => { injectPaymentStyles(); }, []);
  if (!user) return null;

  return (
    <div className="ps-root">
      <h3 className="ps-heading">Payment Method</h3>

      <div className="ps-security">
        <span className="ps-security-icon">🔒</span>
        <span className="ps-security-text">
          <strong>256-bit SSL encrypted</strong> · PCI DSS Level 1 certified ·
          Your card details are never stored on our servers
        </span>
      </div>

      <div className="ps-method-grid">
        {PAYMENT_METHODS.map((m) => (
          <button
            key={m.id}
            className={`ps-method-btn ${paymentMethod === m.id ? "active" : ""}`}
            onClick={() => setPaymentMethod(m.id)}
            type="button"
          >
            <span className="ps-method-emoji">{m.emoji}</span>
            <span className="ps-method-label">{m.label}</span>
            <span className="ps-method-sub">{m.sub}</span>
          </button>
        ))}
      </div>

      <div className="ps-rzp-brand">
        <div className="ps-rzp-logo">
          <div className="ps-rzp-logo-mark"><RazorpayLogoMark /></div>
          <span className="ps-rzp-logo-wordmark">razorpay</span>
        </div>
        <span className="ps-rzp-brand-text">
          All payments processed securely · UPI · Cards · Net Banking · Wallets
        </span>
      </div>
    </div>
  );
}

// ── BOOKING SUMMARY CARD (replaces old summary-card div) ──────────────────
function BookingSummaryCard({ flight, taxes, total, loading, handlePayWithRazorpay, user, onSignIn }) {
  useEffect(() => { injectPaymentStyles(); }, []);

  const detailRows = [
    ["Departure",    fmtTime(flight.dep)],
    ["Outbound Date",fmtDate(flight.dep)],
    ...(flight.isRoundTrip && flight.returnFlight ? [
      ["Return",      fmtTime(flight.returnFlight.dep)],
      ["Return Date", fmtDate(flight.returnFlight.dep)],
    ] : []),
    ["Duration", flight.duration],
    ["Stops",    flight.stops === 0 ? "Non-stop" : `${flight.stops} stop`],
  ];

  return (
    <div className="bsc-root">
      <div className="bsc-card">

        {/* Dark airline header band */}
        <div className="bsc-airline-band">
          <div className="bsc-airline-icon">✈️</div>
          <div>
            <div className="bsc-airline-name">{flight.airline.name}</div>
            <div className="bsc-airline-type">
              {flight.isRoundTrip ? "Round Trip" : "One Way"} · {flight.class}
            </div>
          </div>
        </div>

        {/* Route cities — boarding-pass style */}
        <div className="bsc-route">
          <div className="bsc-route-cities">
            <div className="bsc-city-block">
              <div className="bsc-iata">{flight.from}</div>
              <div className="bsc-city">{fmtTime(flight.dep)}</div>
            </div>
            <div className="bsc-flight-line">
              <div className="bsc-duration">{flight.duration}</div>
              <div className="bsc-line-track">
                <div className="bsc-line-dot" />
                <div className="bsc-line-dashes" />
                <span className="bsc-plane-icon">✈</span>
                <div className="bsc-line-dashes" />
                <div className="bsc-line-dot" />
              </div>
              <div className="bsc-stops">
                {flight.stops === 0 ? "Non-stop" : `${flight.stops} stop`}
              </div>
            </div>
            <div className="bsc-city-block" style={{ textAlign: "right" }}>
              <div className="bsc-iata">{flight.to}</div>
              <div className="bsc-city">{fmtTime(flight.arr)}</div>
            </div>
          </div>
        </div>

        {/* Detail rows */}
        <div className="bsc-details">
          {detailRows.map(([k, v]) => (
            <div key={k} className="bsc-detail-row">
              <span className="bsc-detail-key">{k}</span>
              <span className="bsc-detail-val">{v}</span>
            </div>
          ))}
        </div>

        {/* Fare breakdown */}
        <div className="bsc-fare">
          <div className="bsc-fare-row">
            <span className="bsc-fare-key">Base fare</span>
            <span className="bsc-fare-val">₹ {flight.price?.toLocaleString()}</span>
          </div>
          <div className="bsc-fare-row">
            <span className="bsc-fare-key">Taxes & fees (12%)</span>
            <span className="bsc-fare-val">₹ {taxes?.toLocaleString()}</span>
          </div>
          <div className="bsc-fare-row">
            <span className="bsc-fare-key">Passengers</span>
            <span className="bsc-fare-val">× {flight.pax || 1}</span>
          </div>
          <div className="bsc-fare-divider" />
          <div className="bsc-total-row">
            <span className="bsc-total-key">Total</span>
            <span className="bsc-total-val">₹ {total?.toLocaleString()}</span>
          </div>
        </div>

        {/* CTA footer */}
        <div className="bsc-footer">
          <button
            className="ps-pay-btn"
            onClick={handlePayWithRazorpay}
            disabled={loading}
            type="button"
          >
            <div className="ps-pay-btn-inner">
              {loading ? (
                <><div className="ps-pay-spinner" /> Processing payment…</>
              ) : user ? (
                <>✈ Pay ₹{total?.toLocaleString()} securely</>
              ) : (
                <>🔐 Sign in to Book</>
              )}
            </div>
          </button>

          {!user && (
            <div className="bsc-guest-note">
              A Google account is required to complete booking.{" "}
              <button
                onClick={onSignIn}
                style={{
                  background: "none", border: "none", color: "#c1440e",
                  fontWeight: 700, cursor: "pointer",
                  fontFamily: "inherit", fontSize: "inherit", padding: 0,
                }}
              >
                Sign in →
              </button>
            </div>
          )}

          {user && (
            <div className="bsc-secure-note">
              <span>🔒</span> Secured by Razorpay · {user.email}
            </div>
          )}

          <div className="ps-trust-row">
            {[
              { icon: "🛡️", text: "PCI DSS\nCertified" },
              { icon: "🔐", text: "256-bit\nEncryption" },
              { icon: "↩️", text: "Easy\nRefunds" },
            ].map((b) => (
              <div key={b.text} className="ps-trust-badge">
                <span className="ps-trust-icon">{b.icon}</span>
                <span className="ps-trust-text">{b.text}</span>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}

// ── ANIMATED FLIGHT PATH ─────────────────────────────────────────────────
function FlightAnimation() {
  return (
    <div className="flight-track">
      <svg style={{position:"absolute",inset:0,width:"100%",height:"100%",pointerEvents:"none"}} viewBox="0 0 1440 700" preserveAspectRatio="none">
        <path d="M -100 380 Q 360 200 720 340 Q 1080 480 1540 280"
          stroke="rgba(193,98,47,0.08)" strokeWidth="1.5" fill="none" strokeDasharray="8 12"/>
        <path d="M -100 500 Q 400 360 720 440 Q 1040 520 1540 420"
          stroke="rgba(193,98,47,0.05)" strokeWidth="1" fill="none" strokeDasharray="6 14"/>
      </svg>
      <div className="animated-plane" style={{top:"30%",animationName:"flyAcross",animationDuration:"18s",animationDelay:"0s"}}>
        <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
          <path d="M28 14l-8-2-6-8H10l4 8-8 1-2-3H2l2 6-2 6h2l2-3 8 1-4 8h4l6-8 8-2c2-1 2-7 0-8z" fill="rgba(193,98,47,0.85)" />
        </svg>
      </div>
      <div className="animated-plane" style={{top:"55%",animationName:"flyAcross2",animationDuration:"24s",animationDelay:"8s",transform:"scale(0.65)"}}>
        <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
          <path d="M28 14l-8-2-6-8H10l4 8-8 1-2-3H2l2 6-2 6h2l2-3 8 1-4 8h4l6-8 8-2c2-1 2-7 0-8z" fill="rgba(193,98,47,0.55)" />
        </svg>
      </div>
      <div className="animated-plane" style={{top:"70%",right:0,left:"auto",animationName:"flyAcross3",animationDuration:"30s",animationDelay:"14s",transform:"scale(0.5) scaleX(-1)"}}>
        <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
          <path d="M28 14l-8-2-6-8H10l4 8-8 1-2-3H2l2 6-2 6h2l2-3 8 1-4 8h4l6-8 8-2c2-1 2-7 0-8z" fill="rgba(193,98,47,0.35)" />
        </svg>
      </div>
    </div>
  );
}

// ── COMPONENTS ────────────────────────────────────────────────────────────
function GoogleIcon() {
  return (
    <svg className="google-icon" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  );
}

function Nav({ user, onSignIn, onSignOut, onHome }) {
  return (
    <nav>
      <button className="nav-logo" onClick={onHome} style={{ background:"none", border:"none", cursor:"pointer" }}>
        <svg width="26" height="26" viewBox="0 0 28 28" fill="none">
          <path d="M14 3L3 14l3.5 2.5 5.5-3.5v10l2 2 2-2v-10l5.5 3.5L25 14 14 3z" fill="currentColor"/>
        </svg>
        SkyBook
      </button>
      <div className="nav-right">
        {user ? (
          <div className="user-chip">
            <div className="avatar">
              {user.picture
                ? <img src={user.picture} alt={user.name} referrerPolicy="no-referrer"/>
                : user.name[0]
              }
            </div>
            <span className="user-name">{user.name}</span>
            <button className="sign-out-btn" onClick={onSignOut}>Sign out</button>
          </div>
        ) : (
          <button className="btn-ghost" onClick={onSignIn}>Sign In</button>
        )}
      </div>
    </nav>
  );
}

// ── SEARCH FORM ───────────────────────────────────────────────────────────
function SearchForm({ onSearch, compact = false }) {
  const today = new Date().toISOString().split("T")[0];
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split("T")[0];
  const [form, setForm] = useState({
    from: "", to: "", date: today, returnDate: tomorrow,
    pax: 1, cabin: "economy", type: "one-way"
  });
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const submit = () => {
    if (!form.from.trim() || !form.to.trim() || !form.date) {
      alert("Please fill in From, To, and Date."); return;
    }
    if (form.type === "round-trip" && !form.returnDate) {
      alert("Please select a return date."); return;
    }
    if (form.type === "round-trip" && form.returnDate <= form.date) {
      alert("Return date must be after departure date."); return;
    }
    onSearch(form);
  };

  const isRoundTrip = form.type === "round-trip";

  return (
    <div className={compact ? "" : "search-section"}>
      <div className="search-card">
        <div className="search-tabs">
          {["one-way","round-trip"].map(t => (
            <button key={t} className={`tab-btn ${form.type===t?"active":""}`} onClick={() => set("type",t)}>
              {t==="one-way" ? "One Way" : "Round Trip"}
            </button>
          ))}
        </div>
        <div className={`search-grid ${isRoundTrip ? "" : "one-way"}`}>
          <div className="search-field">
            <label className="search-label">From</label>
            <input className="search-input" placeholder="DEL, Mumbai…"
              value={form.from} onChange={e => set("from", e.target.value.toUpperCase())} />
          </div>
          <div className="search-field">
            <label className="search-label">To</label>
            <input className="search-input" placeholder="BOM, Dubai…"
              value={form.to} onChange={e => set("to", e.target.value.toUpperCase())} />
          </div>
          <div className="search-field">
            <label className="search-label">Depart</label>
            <input type="date" className="search-input" min={today}
              value={form.date} onChange={e => set("date", e.target.value)} />
          </div>
          {isRoundTrip && (
            <div className="search-field">
              <label className="search-label">Return</label>
              <input type="date" className="search-input" min={form.date || today}
                value={form.returnDate} onChange={e => set("returnDate", e.target.value)} />
            </div>
          )}
          <div className="search-field">
            <label className="search-label">Pax</label>
            <input type="number" className="search-input" min={1} max={9}
              value={form.pax} onChange={e => set("pax", parseInt(e.target.value)||1)} />
          </div>
          <div className="search-field">
            <label className="search-label">Cabin</label>
            <select className="search-input" value={form.cabin} onChange={e => set("cabin", e.target.value)}>
              <option value="economy">Economy</option>
              <option value="premium_economy">Premium Economy</option>
              <option value="business">Business</option>
              <option value="first">First Class</option>
            </select>
          </div>
          <button className="search-btn" onClick={submit}>Search ✈️</button>
        </div>
      </div>
    </div>
  );
}
function FlightCard({ flight, onSelect, onToggleCompare, isCompareChecked }) {
  const displayPrice = flight.price > 100000 ? flight.price / 100 : flight.price;

  return (
    <div className={`flight-card ${flight.best ? "best" : ""} ${isCompareChecked ? "compare-checked" : ""}`}>
      {flight.best && <div className="best-tag">✦ Best Value</div>}

      <div className="fc-main">
        <div className="airline-info">
          <div className="airline-logo">✈️</div>
          <div>
            <div className="airline-name">{flight.airline.name}</div>
            <div className="airline-no">{flight.airline.code} · {flight.class}</div>
          </div>
        </div>

        <div className="route-viz">
          <div className="route-end">
            <div className="route-iata">{flight.from}</div>
            <div className="route-city">{CITY_MAP[flight.from] || flight.from}</div>
            <div className="route-time">{fmtTime(flight.dep)}</div>
          </div>
          <div className="route-mid">
            <div className="route-dur">{flight.duration}</div>
            <div className="route-line" />
            <div className="route-stops">{flight.stops === 0 ? "Non-stop ✈" : `${flight.stops} stop`}</div>
          </div>
          <div className="route-end">
            <div className="route-iata">{flight.to}</div>
            <div className="route-city">{CITY_MAP[flight.to] || flight.to}</div>
            <div className="route-time">{fmtTime(flight.arr)}</div>
          </div>
        </div>

        <div className="price-block">
          <div className="price-val">₹ {Number(displayPrice).toLocaleString("en-IN")}</div>
          <div className="price-pp">per person</div>
          <button className="select-btn" onClick={() => onSelect(flight)}>Select →</button>
        </div>
      </div>

      <div className="fc-tags">
        {flight.stops === 0 && <span className="tag tag-green">Non-stop</span>}
        {flight.meal && <span className="tag tag-warm">Meal included</span>}
        {flight.refundable && <span className="tag tag-green">Refundable</span>}
        <span className="tag tag-grey">🧳 {flight.baggage}</span>
        <span className="tag tag-grey">{flight.class}</span>

        {/* ── COMPARE TOGGLE ── */}
        <button
          onClick={(e) => { e.stopPropagation(); onToggleCompare(flight); }}
          style={{
            marginLeft: "auto", background: isCompareChecked ? "var(--terra)" : "none",
            border: `1.5px solid ${isCompareChecked ? "var(--terra)" : "var(--sand)"}`,
            color: isCompareChecked ? "#fff" : "var(--muted)",
            borderRadius: 20, fontSize: "0.72rem", fontWeight: 700,
            padding: "3px 12px", cursor: "pointer", fontFamily: "var(--body)",
            transition: "all .2s",
          }}
        >
          {isCompareChecked ? "✓ Added" : "+ Compare"}
        </button>
      </div>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="skeleton-card">
      <div style={{display:"flex",gap:16,alignItems:"center",marginBottom:16}}>
        <div className="skeleton" style={{width:44,height:44,borderRadius:10}}/>
        <div style={{flex:1}}>
          <div className="skeleton" style={{height:14,width:"40%",marginBottom:8}}/>
          <div className="skeleton" style={{height:10,width:"25%"}}/>
        </div>
        <div style={{textAlign:"right"}}>
          <div className="skeleton" style={{height:22,width:80,marginBottom:6}}/>
          <div className="skeleton" style={{height:32,width:90,borderRadius:8}}/>
        </div>
      </div>
      <div style={{display:"flex",justifyContent:"space-between"}}>
        <div className="skeleton" style={{height:10,width:"15%"}}/>
        <div className="skeleton" style={{height:10,width:"20%"}}/>
        <div className="skeleton" style={{height:10,width:"15%"}}/>
      </div>
    </div>
  );
}

// ── GOOGLE SIGN-IN MODAL ─────────────────────────────────────────────────
function SignInModal({ onClose, onSignIn }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const googleBtnRef = useRef(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const loaded = await loadGoogleGIS();
      if (!loaded || !mounted) return;
      if (!window.google?.accounts?.id) return;
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: async (response) => {
          if (!mounted) return;
          setLoading(true); setError("");
          try {
            const userData = await verifyGoogleToken(response.credential);
            onSignIn(userData); onClose();
          } catch {
            setError("Sign-in failed. Please try again.");
          } finally {
            if (mounted) setLoading(false);
          }
        },
        ux_mode: "popup",
      });
      if (googleBtnRef.current) {
        window.google.accounts.id.renderButton(googleBtnRef.current, {
          type:"standard", shape:"rectangular",
          theme:"outline", text:"continue_with", size:"large", width:320,
        });
      }
    })();
    return () => { mounted = false; };
  }, [onSignIn, onClose]);

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>✕</button>
        <div className="modal-plane">✈️</div>
        <div className="modal-title">Welcome to SkyBook</div>
        <div className="modal-sub">
          Sign in to book flights, manage your trips,<br/>
          and get personalised recommendations.
        </div>
        {error && <div className="error-banner">⚠️ {error}</div>}
        {loading ? (
          <div className="auth-loading"><div className="spinner"/>Verifying your account…</div>
        ) : (
          <div ref={googleBtnRef} style={{display:"flex",justifyContent:"center",marginBottom:20}}/>
        )}
        <div style={{fontSize:"0.73rem",color:"var(--muted)",lineHeight:1.6}}>
          By signing in you agree to our Terms & Privacy Policy.<br/>
          <span style={{color:"var(--terra)",fontWeight:500}}>Guests can browse flights without signing in.</span>
        </div>
      </div>
    </div>
  );
}

// ── PRICE PREDICTOR AGENT ─────────────────────────────────────────────────
function PricePredictorAgent() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ from:"", to:"", date:"", cabin:"economy", price:"" });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const set = (k, v) => { setForm(p => ({...p,[k]:v})); setResult(null); };
  const today = new Date().toISOString().split("T")[0];

  const analyze = async () => {
    if (!form.from || !form.to || !form.date) { alert("Please fill in From, To, and Date."); return; }
    setLoading(true); setResult(null);
    const route = `${form.from.toUpperCase()} → ${form.to.toUpperCase()}`;
    const data = await askPricePredictor(route, form.date, form.cabin, form.price ? parseInt(form.price) : null);
    setResult(data); setLoading(false);
  };

  const verdictClass = result ? result.verdict==="BUY NOW"?"buy":result.verdict==="WAIT"?"wait":"neutral" : "";
  const verdictEmoji = result ? result.verdict==="BUY NOW"?"🟢":result.verdict==="WAIT"?"🟡":"⚪" : "";
  const trendEmoji = result?.price_trend==="RISING"?"📈":result?.price_trend==="FALLING"?"📉":"➡️";

  return (
    <div className="price-fab">
      {open && (
        <div className="price-panel">
          <div className="price-panel-header">
            <div className="price-dot"/>
            <div style={{flex:1}}>
              <div className="price-header-name">Price Predictor AI</div>
              <div className="price-header-sub">Powered by Claude · Should you buy now?</div>
            </div>
            <button className="ai-close-btn" onClick={() => setOpen(false)}>✕</button>
          </div>
          <div className="price-body">
            <div className="price-form">
              <div className="price-grid">
                <div className="price-field">
                  <label className="price-label">From</label>
                  <input className="price-input" placeholder="DEL" value={form.from}
                    onChange={e => set("from", e.target.value.toUpperCase())}/>
                </div>
                <div className="price-field">
                  <label className="price-label">To</label>
                  <input className="price-input" placeholder="DXB" value={form.to}
                    onChange={e => set("to", e.target.value.toUpperCase())}/>
                </div>
              </div>
              <div className="price-field">
                <label className="price-label">Travel Date</label>
                <input type="date" className="price-input" min={today}
                  value={form.date} onChange={e => set("date", e.target.value)}/>
              </div>
              <div className="price-grid">
                <div className="price-field">
                  <label className="price-label">Cabin</label>
                  <select className="price-input" value={form.cabin} onChange={e => set("cabin", e.target.value)}>
                    <option value="economy">Economy</option>
                    <option value="premium_economy">Prem. Economy</option>
                    <option value="business">Business</option>
                    <option value="first">First</option>
                  </select>
                </div>
                <div className="price-field">
                  <label className="price-label">Current Price (₹)</label>
                  <input className="price-input" type="number" placeholder="optional"
                    value={form.price} onChange={e => set("price", e.target.value)}/>
                </div>
              </div>
            </div>
            <button className="analyze-btn" onClick={analyze} disabled={loading}>
              {loading ? "Analysing…" : "🔍 Predict Price"}
            </button>
            {loading && (
              <div className="pred-loading"><div className="pred-spinner"/>Consulting market data…</div>
            )}
            {result && !loading && (
              <div className="prediction-result">
                <div className="pred-label">AI Recommendation</div>
                <div className={`pred-verdict ${verdictClass}`}>
                  {verdictEmoji} {result.verdict}
                  <span style={{fontSize:"0.72rem",marginLeft:6,color:"var(--muted)",fontWeight:400}}>
                    {trendEmoji} Price {result.price_trend}
                  </span>
                </div>
                <div className="pred-text">
                  <strong style={{display:"block",marginBottom:4}}>{result.summary}</strong>
                  {result.reasoning}
                  {result.best_booking_window && (
                    <span style={{display:"block",marginTop:6,color:"var(--muted)"}}>
                      📅 Best window: {result.best_booking_window}
                    </span>
                  )}
                </div>
                <div className="pred-confidence">
                  <div className="pred-conf-bar">
                    <div className="pred-conf-fill" style={{width:`${result.confidence}%`}}/>
                  </div>
                  <span className="pred-conf-label">{result.confidence}% confidence</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      <button className="price-toggle" onClick={() => setOpen(p => !p)} title="Price Predictor AI">
        {open ? "✕" : "📊"}
      </button>
    </div>
  );
}
// ── Supabase client helpers ───────────────────────────────────────────────

function getBrowserId() {
  let id = localStorage.getItem("skybook_browser_id");
  if (!id) {
    id = `br_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    localStorage.setItem("skybook_browser_id", id);
  }
  return id;
}

async function dbGetSessions(browserId) {
  const { data, error } = await supabase
    .from("chat_sessions")
    .select("*")
    .eq("browser_id", browserId)
    .order("updated_at", { ascending: false })
    .limit(20);
  if (error) throw new Error(error.message);
  return data;
}

async function dbCreateSession(id, browserId, title = "New Chat") {
  const { data, error } = await supabase
    .from("chat_sessions")
    .insert({ id, browser_id: browserId, title })
    .select();
  if (error) throw new Error(error.message);
  return data[0];
}

async function dbUpdateSession(id, fields) {
  const { data, error } = await supabase
    .from("chat_sessions")
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select();
  if (error) throw new Error(error.message);
  return data[0];
}

async function dbDeleteSession(id) {
  const { error } = await supabase
    .from("chat_sessions")
    .delete()
    .eq("id", id);
  if (error) throw new Error(error.message);
}

async function dbGetMessages(sessionId) {
  const { data, error } = await supabase
    .from("chat_messages")
    .select("*")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return data;
}

async function dbAddMessage(sessionId, role, content) {
  const { data, error } = await supabase
    .from("chat_messages")
    .insert({ session_id: sessionId, role, content })
    .select();
  if (error) throw new Error(error.message);
  return data[0];
}

// ── AI CHAT ───────────────────────────────────────────────────────────────
function AiChat() {
  const [open, setOpen]                   = useState(false);
  const [msgs, setMsgs]                   = useState(null);
  const [inp, setInp]                     = useState("");
  const [loading, setLoading]             = useState(false);
  const [showHistory, setShowHistory]     = useState(false);
  const [sessions, setSessions]           = useState([]);
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [dbReady, setDbReady]             = useState(false);
  const [dbError, setDbError]             = useState("");
  const endRef   = useRef(null);
  const inputRef = useRef(null);

  const WELCOME_TEXT =
    "Happy to help — which route are you looking at?\n\nTry: *\"Flights from Delhi to Dubai tomorrow\"*";
  useEffect(() => {
    (async () => {
      const browserId = getBrowserId();
      try {
        const sessionList = await dbGetSessions(browserId);
        setSessions(sessionList);
        setDbReady(true);
        const lastId = localStorage.getItem("skybook_last_session");
        const lastSession = lastId && sessionList.find((s) => s.id === lastId);
        if (lastSession) {
          await loadSession(lastSession.id, false);
        } else {
          await createNewSession(browserId);
        }
      } catch (e) {
        setDbError("Could not connect to Supabase. Check your URL & key.");
        setMsgs([{ role: "bot", text: WELCOME_TEXT }]);
        setCurrentSessionId("local");
        setDbReady(false);
      }
    })();
  }, []);

  const createNewSession = async (browserId) => {
    const bid = browserId || getBrowserId();
    const sid = `s_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    try {
      await dbCreateSession(sid, bid, "New Chat");
      await dbAddMessage(sid, "bot", WELCOME_TEXT);
      localStorage.setItem("skybook_last_session", sid);
    } catch {}
    setCurrentSessionId(sid);
    setMsgs([{ role: "bot", text: WELCOME_TEXT }]);
    setShowHistory(false);
    try {
      const updated = await dbGetSessions(bid);
      setSessions(updated);
    } catch {}
  };

  const loadSession = async (sid, closeHistory = true) => {
    try {
      const rows = await dbGetMessages(sid);
      const messages = rows.map((r) => ({ role: r.role, text: r.content }));
      setCurrentSessionId(sid);
      setMsgs(messages.length ? messages : [{ role: "bot", text: WELCOME_TEXT }]);
      localStorage.setItem("skybook_last_session", sid);
      if (closeHistory) setShowHistory(false);
    } catch {
      setDbError("Failed to load session.");
    }
  };

  const deleteSession = async (e, sid) => {
    e.stopPropagation();
    try {
      await dbDeleteSession(sid);
      const updated = sessions.filter((s) => s.id !== sid);
      setSessions(updated);
      if (sid === currentSessionId) await createNewSession();
    } catch {
      setDbError("Failed to delete session.");
    }
  };

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs, loading]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100);
  }, [open]);

  const send = useCallback(
    async (text) => {
      const txt = (text || inp).trim();
      if (!txt || loading || !msgs) return;
      setInp("");
      setLoading(true);
      const userMsg = { role: "user", text: txt };
      const newMsgs = [...msgs, userMsg];
      setMsgs(newMsgs);
      if (dbReady && currentSessionId !== "local") {
        try {
          await dbAddMessage(currentSessionId, "user", txt);
          const firstUser = newMsgs.find((m) => m.role === "user");
          if (firstUser) {
            const title = firstUser.text.slice(0, 60) + (firstUser.text.length > 60 ? "…" : "");
            await dbUpdateSession(currentSessionId, { title });
            setSessions((prev) =>
              prev.map((s) => (s.id === currentSessionId ? { ...s, title } : s))
            );
          }
        } catch {}
      }
      const history = newMsgs
        .filter((_, i) => i > 0)
        .map((m) => ({ role: m.role === "bot" ? "assistant" : "user", content: m.text }));
      const reply = await askAI(history);
      const botMsg = { role: "bot", text: reply };
      setMsgs((prev) => [...prev, botMsg]);
      if (dbReady && currentSessionId !== "local") {
        try {
          await dbAddMessage(currentSessionId, "bot", reply);
          await dbUpdateSession(currentSessionId, {});
          const updated = await dbGetSessions(getBrowserId());
          setSessions(updated);
        } catch {}
      }
      setLoading(false);
    },
    [inp, msgs, loading, currentSessionId, dbReady]
  );

  const formatDate = (ts) =>
    new Date(ts).toLocaleDateString("en-IN", {
      day: "numeric", month: "short",
      hour: "2-digit", minute: "2-digit",
    });

  if (msgs === null) return null;

  return (
    <div className="ai-fab">

      {/* ── HISTORY PANEL — floats separately, does not push chat ── */}
      {open && showHistory && (
        <div style={{
          position: "absolute", bottom: 72, right: 0,
          width: 420, background: "#fff",
          borderRadius: 20, border: "0.5px solid var(--sand)",
          boxShadow: "0 20px 60px rgba(0,0,0,0.15)",
          overflow: "hidden", zIndex: 160,
          animation: "slideUp 0.25s cubic-bezier(.4,0,.2,1)",
          maxHeight: 420, display: "flex", flexDirection: "column",
        }}>
          {/* History header */}
          <div style={{
            padding: "13px 15px", background: "#1a1410",
            display: "flex", alignItems: "center", justifyContent: "space-between",
            flexShrink: 0,
          }}>
            <span style={{ fontSize: "0.84rem", fontWeight: 600, color: "#fff" }}>
              Recent Conversations
            </span>
            <button
              onClick={() => setShowHistory(false)}
              style={{
                background: "rgba(255,255,255,0.08)", border: "none",
                color: "rgba(255,255,255,0.6)", cursor: "pointer",
                width: 26, height: 26, borderRadius: 6,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "0.82rem",
              }}
            >✕</button>
          </div>

          {/* Session list */}
          <div style={{ overflowY: "auto", flex: 1 }}>
            {sessions.length === 0 ? (
              <div style={{ padding: "14px 16px", fontSize: "0.8rem", color: "var(--muted)" }}>
                No saved chats yet.
              </div>
            ) : (
              sessions.map((s) => (
                <div
                  key={s.id}
                  onClick={() => loadSession(s.id)}
                  style={{
                    padding: "10px 14px", cursor: "pointer",
                    display: "flex", alignItems: "center", gap: 8,
                    background: s.id === currentSessionId ? "var(--cream2)" : "transparent",
                    borderLeft: s.id === currentSessionId ? "3px solid var(--terra)" : "3px solid transparent",
                    borderBottom: "0.5px solid var(--sand)",
                    transition: "background 0.15s",
                  }}
                  onMouseEnter={(e) => {
                    if (s.id !== currentSessionId) e.currentTarget.style.background = "var(--cream2)";
                  }}
                  onMouseLeave={(e) => {
                    if (s.id !== currentSessionId) e.currentTarget.style.background = "transparent";
                  }}
                >
                  <span style={{ fontSize: 13 }}>💬</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: "0.8rem", fontWeight: 600, color: "var(--ink)",
                      whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                    }}>
                      {s.title}
                    </div>
                    <div style={{ fontSize: "0.68rem", color: "var(--muted)", marginTop: 1 }}>
                      {formatDate(s.updated_at)}
                    </div>
                  </div>
                  <button
                    onClick={(e) => deleteSession(e, s.id)}
                    style={{
                      background: "none", border: "none", color: "var(--muted)",
                      cursor: "pointer", fontSize: 13, padding: "2px 4px",
                      borderRadius: 4, flexShrink: 0,
                    }}
                  >🗑️</button>
                </div>
              ))
            )}
          </div>

          {/* New conversation button */}
          <div style={{ padding: "10px 14px", borderTop: "0.5px solid var(--sand)", flexShrink: 0 }}>
            <button
              onClick={() => { createNewSession(); setShowHistory(false); }}
              style={{
                width: "100%", background: "var(--terra)", color: "#fff",
                border: "none", borderRadius: 8, padding: "9px",
                fontSize: "0.78rem", fontWeight: 700, cursor: "pointer",
                fontFamily: "var(--body)",
              }}
            >✏️ New Conversation</button>
          </div>
        </div>
      )}

      {/* ── CHAT BOX ── */}
      {open && (
        <div className="ai-chat-box">

          {/* Header */}
          <div className="ai-chat-header">
            <div className="ai-dot" />
            <div style={{ flex: 1 }}>
              <div className="ai-header-name">SkyBook AI Agent</div>
              <div className="ai-header-sub">
                {dbReady ? "Powered by Groq · History saved" : "Powered by Groq · Live Duffel data"}
              </div>
            </div>

            {/* History toggle */}
            <button
              onClick={() => setShowHistory((p) => !p)}
              title="Chat history"
              style={{
                background: showHistory ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.08)",
                border: "none", color: "rgba(255,255,255,0.7)", cursor: "pointer",
                fontSize: 14, width: 28, height: 28, borderRadius: 6, marginRight: 4,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >🕐</button>

            {/* New chat */}
            <button
              onClick={() => createNewSession()}
              title="New chat"
              style={{
                background: "rgba(255,255,255,0.08)",
                border: "none", color: "rgba(255,255,255,0.7)", cursor: "pointer",
                fontSize: 14, width: 28, height: 28, borderRadius: 6, marginRight: 4,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >✏️</button>

            <button className="ai-close-btn" onClick={() => setOpen(false)}>✕</button>
          </div>

          {/* DB error banner */}
          {dbError && (
            <div style={{
              background: "#fff3cd", borderBottom: "1px solid #ffc107",
              padding: "8px 14px", fontSize: "0.75rem", color: "#856404",
            }}>
              ⚠️ {dbError}
            </div>
          )}

          {/* Messages */}
          <div className="ai-messages">
            {msgs.map((m, i) => (
              <div key={i} className={`ai-msg ${m.role}`}>
                {m.text}
              </div>
            ))}
            {loading && (
              <div className="ai-typing">
                <span /><span /><span />
              </div>
            )}
            <div ref={endRef} />
          </div>

          {/* Quick replies */}
          {msgs.length <= 1 && (
            <div className="ai-quick-replies">
              {QUICK_REPLIES.map((q) => (
                <button key={q} className="quick-reply" onClick={() => send(q)}>
                  {q}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="ai-input-row">
            <input
              ref={inputRef}
              className="ai-input"
              placeholder="e.g. Cheapest flights to London…"
              value={inp}
              onChange={(e) => setInp(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send()}
            />
            <button
              className="ai-send"
              onClick={() => send()}
              disabled={loading || !inp.trim()}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2.5">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </div>

        </div>
      )}

      <button
        className="ai-toggle"
        onClick={() => setOpen((p) => !p)}
        title="Ask SkyBook AI"
      >
        {open ? "✕" : "✈"}
      </button>
    </div>
  );
}

// ── PAGES ─────────────────────────────────────────────────────────────────
function LandingPage({ onSearch, onSignIn }) {
  const particles = Array.from({length:12}, () => ({
    size: Math.random()*80+20,
    left: Math.random()*100,
    duration: Math.random()*20+15,
    delay: Math.random()*10,
  }));

  return (
    <>
      <div className="hero">
        <div className="hero-particles">
          {particles.map((p,i) => (
            <div key={i} className="particle" style={{
              width:p.size, height:p.size, left:`${p.left}%`,
              animationDuration:`${p.duration}s`, animationDelay:`${p.delay}s`,
            }}/>
          ))}
        </div>
        <div className="hero-grid"/>
        <FlightAnimation />
        <div className="hero-content">
          <div className="hero-eyebrow">✦ AI-Powered Flight Booking</div>
          <h1 className="hero-title">
            Find your <em>perfect</em><br/>flight, instantly.
          </h1>
          <p className="hero-sub">
            Tell us where you want to go. SkyBook AI finds the best routes, compares prices, and guides you every step of the way.
          </p>
          <div className="hero-cta">
            <button className="btn-hero btn-hero-primary"
              onClick={() => document.getElementById("search-anchor")?.scrollIntoView({behavior:"smooth"})}>
              Search Flights
            </button>
            <button className="btn-hero btn-hero-secondary" onClick={onSignIn}>Sign In</button>
          </div>
        </div>
        <div id="search-anchor"/>
        <SearchForm onSearch={onSearch}/>
      </div>

      <div className="features">
        <div className="features-inner">
          <div className="section-eyebrow">Why SkyBook</div>
          <div className="section-title">Everything you need,<br/>nothing you don't.</div>
          <div className="features-grid">
            {[
              { icon:"🤖", title:"AI Flight Agent", desc:"Chat naturally to search flights, compare options, and get expert advice. Our AI understands context — not just keywords." },
              { icon:"📊", title:"Price Predictor", desc:"Our second AI agent analyses price trends and tells you whether to buy now or wait. Powered by Claude's market intelligence." },
              { icon:"🔒", title:"Secure Payments", desc:"Google sign-in with backend verification. Payments powered by Razorpay — UPI, cards, net banking, wallets all supported." },
            ].map(f => (
              <div key={f.title} className="feat-card">
                <div className="feat-icon">{f.icon}</div>
                <div className="feat-title">{f.title}</div>
                <div className="feat-desc">{f.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

// ── RESULTS PAGE ──────────────────────────────────────────────────────────
// ── COMPARE DRAWER ────────────────────────────────────────────────────────
function CompareDrawer({ flights, onClose }) {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const drawerRef = useRef(null);

  useEffect(() => {
    drawerRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    runCompare();
  }, []);

 // AFTER — uses its own dedicated endpoint:
const runCompare = async () => {
  const [a, b] = flights;
  try {
    const res = await fetch(`${API_BASE}/ai/compare`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ flight_a: a, flight_b: b }),
    });
    if (!res.ok) throw new Error("Compare failed");
    const data = await res.json();
    setResult(data);
  } catch {
    setResult({ error: true });
  }
  setLoading(false);
};
  const rc = (r) => r === "good" ? "#1a6b3c" : r === "bad" ? "#c1440e" : "var(--ink)";
  const [a, b] = flights;

  const MetricRow = ({ label, valA, ratingA, valB, ratingB }) => (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", borderBottom: "1px solid var(--cream2)" }}>
      <div style={{ padding: "7px 14px", fontSize: "0.76rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ color: "var(--muted)", fontSize: "0.72rem" }}>{label}</span>
        <span style={{ fontWeight: 700, color: rc(ratingA) }}>{valA}</span>
      </div>
      <div style={{ padding: "7px 14px", fontSize: "0.76rem", display: "flex", justifyContent: "space-between", alignItems: "center", borderLeft: "1px solid var(--cream2)" }}>
        <span style={{ color: "var(--muted)", fontSize: "0.72rem" }}>{label}</span>
        <span style={{ fontWeight: 700, color: rc(ratingB) }}>{valB}</span>
      </div>
    </div>
  );

  return (
    <div ref={drawerRef} style={{ border: "1.5px solid var(--sand)", borderRadius: 16, overflow: "hidden", marginTop: 12, background: "#fff" }}>

      {/* Header */}
      <div style={{ background: "var(--brown)", padding: "14px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ color: "#fff", fontWeight: 700, fontSize: "0.95rem" }}>⚖️ Flight Comparison</div>
          <div style={{ color: "rgba(255,255,255,0.45)", fontSize: "0.72rem", marginTop: 2 }}>AI-powered side-by-side analysis</div>
        </div>
        <button onClick={onClose} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.5)", cursor: "pointer", fontSize: 18 }}>✕</button>
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: "center" }}>
          <div style={{ width: 28, height: 28, border: "2.5px solid var(--cream2)", borderTopColor: "var(--terra)", borderRadius: "50%", animation: "spin 0.7s linear infinite", margin: "0 auto 12px" }} />
          <div style={{ fontSize: "0.82rem", color: "var(--muted)" }}>Analysing flights with AI…</div>
        </div>
      ) : result?.error ? (
        <div style={{ padding: 30, textAlign: "center", color: "var(--terra)", fontSize: "0.82rem" }}>
          Could not analyse flights. Please try again.
        </div>
      ) : (
        <div style={{ padding: 20 }}>

          {/* Score bars */}
          {result && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 40px 1fr", gap: 0, marginBottom: 20 }}>
              <div>
                <div style={{ fontSize: "0.72rem", color: "var(--muted)", marginBottom: 5, textAlign: "center" }}>{a.airline.name}</div>
                <div style={{ height: 6, background: "var(--cream2)", borderRadius: 3, overflow: "hidden", marginBottom: 4 }}>
                  <div style={{ height: "100%", width: `${result.flightA?.score || 0}%`, background: result.winner === "A" ? "#1a6b3c" : "var(--terra)", borderRadius: 3, transition: "width 0.8s ease" }} />
                </div>
                <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--ink)", textAlign: "center" }}>{result.flightA?.score}/100</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                <div style={{ width: 32, height: 32, borderRadius: "50%", background: "var(--cream2)", border: "1.5px solid var(--sand)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.68rem", fontWeight: 700, color: "var(--muted)" }}>VS</div>
              </div>
              <div>
                <div style={{ fontSize: "0.72rem", color: "var(--muted)", marginBottom: 5, textAlign: "center" }}>{b.airline.name}</div>
                <div style={{ height: 6, background: "var(--cream2)", borderRadius: 3, overflow: "hidden", marginBottom: 4 }}>
                  <div style={{ height: "100%", width: `${result.flightB?.score || 0}%`, background: result.winner === "B" ? "#1a6b3c" : "var(--terra)", borderRadius: 3, transition: "width 0.8s ease" }} />
                </div>
                <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--ink)", textAlign: "center" }}>{result.flightB?.score}/100</div>
              </div>
            </div>
          )}

          {/* Column headers */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", border: "1.5px solid var(--sand)", borderRadius: "12px 12px 0 0", overflow: "hidden" }}>
            {[{ flight: a, data: result?.flightA, label: "A" }, { flight: b, data: result?.flightB, label: "B" }].map(({ flight, data, label }, i) => (
              <div key={label} style={{ background: "var(--brown)", padding: "10px 14px", borderLeft: i === 1 ? "1px solid rgba(255,255,255,0.1)" : "none" }}>
                <div style={{ color: "#fff", fontWeight: 700, fontSize: "0.85rem" }}>{flight.airline.name}</div>
                <div style={{ color: "rgba(255,255,255,0.45)", fontSize: "0.7rem", marginTop: 2 }}>{flight.class} · {flight.stops === 0 ? "Non-stop" : `${flight.stops} stop`}</div>
                {result?.winner === label && (
                  <div style={{ background: "var(--terra)", color: "#fff", fontSize: "0.6rem", fontWeight: 700, padding: "2px 8px", borderRadius: 20, display: "inline-block", marginTop: 5 }}>✦ Recommended</div>
                )}
              </div>
            ))}
          </div>

          {/* Price row */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", border: "1.5px solid var(--sand)", borderTop: "none" }}>
            {[a, b].map((f, i) => (
              <div key={i} style={{ padding: "10px 14px", borderLeft: i === 1 ? "1px solid var(--sand)" : "none" }}>
                <div style={{ fontSize: "1.2rem", fontWeight: 800, color: "var(--terra)" }}>₹ {Number(f.price > 100000 ? f.price / 100 : f.price).toLocaleString("en-IN")}</div>
              </div>
            ))}
          </div>

          {/* Metric rows */}
          {result && (
            <div style={{ border: "1.5px solid var(--sand)", borderTop: "none", borderRadius: "0 0 12px 12px", overflow: "hidden" }}>
              <MetricRow label="Departure"  valA={fmtTime(a.dep)}                     ratingA={result.flightA?.duration_rating} valB={fmtTime(b.dep)}                     ratingB={result.flightB?.duration_rating} />
              <MetricRow label="Duration"   valA={a.duration}                          ratingA={result.flightA?.duration_rating} valB={b.duration}                          ratingB={result.flightB?.duration_rating} />
              <MetricRow label="Baggage"    valA={a.baggage}                           ratingA={result.flightA?.baggage_rating}  valB={b.baggage}                           ratingB={result.flightB?.baggage_rating} />
              <MetricRow label="Meal"       valA={a.meal ? "Included ✓" : "Not included"} ratingA={result.flightA?.meal_rating} valB={b.meal ? "Included ✓" : "Not included"} ratingB={result.flightB?.meal_rating} />
              <MetricRow label="Refundable" valA={a.refundable ? "Yes ✓" : "No"}      ratingA={a.refundable ? "good" : "bad"}   valB={b.refundable ? "Yes ✓" : "No"}      ratingB={b.refundable ? "good" : "bad"} />
            </div>
          )}

          {/* Verdict */}
          {result?.verdict && (
            <div style={{ background: "var(--cream2)", border: "1.5px solid var(--sand)", borderRadius: 10, padding: "14px 16px", marginTop: 14 }}>
              <div style={{ fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--terra)", marginBottom: 6 }}>AI Verdict</div>
              <div style={{ fontSize: "0.83rem", color: "var(--brown)", lineHeight: 1.6 }}>{result.verdict}</div>
            </div>
          )}

        </div>
      )}
    </div>
  );
}

// ── RESULTS PAGE ──────────────────────────────────────────────────────────
function ResultsPage({ searchParams, onSelect, onBack, onSearch }) {
  const isRoundTrip = searchParams.type === "round-trip";
  const [activeTab, setActiveTab] = useState("outbound");
  const [outboundFlights, setOutboundFlights] = useState([]);
  const [returnFlights, setReturnFlights] = useState([]);
  const [loadingOut, setLoadingOut] = useState(true);
  const [loadingRet, setLoadingRet] = useState(false);
  const [errorOut, setErrorOut] = useState("");
  const [errorRet, setErrorRet] = useState("");
  const [selectedOutbound, setSelectedOutbound] = useState(null);
  const [sort, setSort] = useState("price");
  const [filter, setFilter] = useState({ nonstop: false, refundable: false });

  // ── NEW: compare state ──
  const [compareList, setCompareList] = useState([]);
  const [showCompare, setShowCompare] = useState(false);

  const toggleCompare = (flight) => {
    setShowCompare(false); // close drawer if open when list changes
    setCompareList(prev => {
      const exists = prev.find(f => f.id === flight.id);
      if (exists) return prev.filter(f => f.id !== flight.id);
      if (prev.length >= 2) return prev; // max 2
      return [...prev, flight];
    });
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoadingOut(true); setErrorOut("");
        const data = await fetchFlights(searchParams.from, searchParams.to, searchParams.date, searchParams.pax, searchParams.cabin);
        if (!cancelled) setOutboundFlights(data);
      } catch {
        if (!cancelled) setErrorOut("No outbound flights found. Try different cities or dates.");
      } finally {
        if (!cancelled) setLoadingOut(false);
      }
    })();
    return () => { cancelled = true; };
  }, [searchParams]);

  useEffect(() => {
    if (!isRoundTrip || activeTab !== "return" || returnFlights.length > 0) return;
    let cancelled = false;
    (async () => {
      try {
        setLoadingRet(true); setErrorRet("");
        const data = await fetchFlights(searchParams.to, searchParams.from, searchParams.returnDate, searchParams.pax, searchParams.cabin);
        if (!cancelled) setReturnFlights(data);
      } catch {
        if (!cancelled) setErrorRet("No return flights found. Try a different return date.");
      } finally {
        if (!cancelled) setLoadingRet(false);
      }
    })();
    return () => { cancelled = true; };
  }, [activeTab, isRoundTrip, searchParams, returnFlights.length]);

  const applyFiltersAndSort = (flights) => {
    let shown = [...flights];
    if (filter.nonstop) shown = shown.filter(f => f.stops === 0);
    if (filter.refundable) shown = shown.filter(f => f.refundable);
    if (sort === "price") shown.sort((a, b) => a.price - b.price);
    else if (sort === "duration") shown.sort((a, b) => (a.duration || "").localeCompare(b.duration || ""));
    else if (sort === "dep") shown.sort((a, b) => (a.dep || "").localeCompare(b.dep || ""));
    return shown.map((f, i) => ({ ...f, best: i === 0 }));
  };

  const handleSelectOutbound = (flight) => {
    if (isRoundTrip) { setSelectedOutbound(flight); setActiveTab("return"); }
    else onSelect(flight);
  };

  const handleSelectReturn = (returnFlight) => {
    onSelect({
      ...selectedOutbound, returnFlight,
      totalPrice: (selectedOutbound.totalPrice || selectedOutbound.price) + (returnFlight.totalPrice || returnFlight.price),
      isRoundTrip: true,
    });
  };

  const currentFlights = activeTab === "outbound" ? outboundFlights : returnFlights;
  const currentLoading = activeTab === "outbound" ? loadingOut : loadingRet;
  const currentError = activeTab === "outbound" ? errorOut : errorRet;
  const shown = applyFiltersAndSort(currentFlights);

  return (
    <div className="page">
      <div className="results-hero">
        <button className="back-link" onClick={onBack}>← Back to search</button>
        <div className="results-title">{searchParams.from} → {searchParams.to}{isRoundTrip ? ` → ${searchParams.from}` : ""}</div>
        <div className="results-sub">
          {searchParams.date}{isRoundTrip ? ` – ${searchParams.returnDate}` : ""} · {searchParams.pax} passenger{searchParams.pax > 1 ? "s" : ""} · {searchParams.cabin} · {searchParams.type}
          {!currentLoading && ` · ${shown.length} flights found`}
        </div>
        {isRoundTrip && (
          <div className="trip-tabs" style={{ marginTop: 16 }}>
            <button className={`trip-tab ${activeTab === "outbound" ? "active" : ""}`} onClick={() => setActiveTab("outbound")}>
              ✈ Outbound · {searchParams.date}
            </button>
            <button className={`trip-tab ${activeTab === "return" ? "active" : ""}`} onClick={() => setActiveTab("return")}
              style={activeTab === "return" ? { background: "#1a6b3c" } : {}}>
              ✈ Return · {searchParams.returnDate}
              {selectedOutbound && activeTab === "outbound" && <span style={{ marginLeft: 6, fontSize: "0.65rem", opacity: 0.7 }}>select first</span>}
            </button>
          </div>
        )}
      </div>

      <div style={{ background: "var(--cream2)", borderBottom: "1px solid var(--sand)", padding: "12px 64px" }}>
        <SearchForm onSearch={(params) => { onSearch(params); window.scrollTo(0, 0); }} compact />
      </div>

      <div className="results-body">
        <div className="filter-card">
          <div className="filter-title">Refine</div>
          <div className="filter-section">
            <div className="filter-label">Sort By</div>
            <select className="sort-select" value={sort} onChange={e => setSort(e.target.value)}>
              <option value="price">Lowest Price</option>
              <option value="duration">Shortest Duration</option>
              <option value="dep">Earliest Departure</option>
            </select>
          </div>
          <div className="filter-section">
            <div className="filter-label">Stops</div>
            <label className="filter-option">
              <input type="checkbox" checked={filter.nonstop}
                onChange={e => setFilter(p => ({ ...p, nonstop: e.target.checked }))} />
              Non-stop only
            </label>
          </div>
          <div className="filter-section">
            <div className="filter-label">Fare Type</div>
            <label className="filter-option">
              <input type="checkbox" checked={filter.refundable}
                onChange={e => setFilter(p => ({ ...p, refundable: e.target.checked }))} />
              Refundable only
            </label>
          </div>
          {(filter.nonstop || filter.refundable) && (
            <button onClick={() => setFilter({ nonstop: false, refundable: false })}
              style={{ background: "none", border: "none", color: "var(--terra)", fontSize: "0.78rem", cursor: "pointer", fontFamily: "var(--body)", fontWeight: 600 }}>
              Clear filters ×
            </button>
          )}
          {isRoundTrip && selectedOutbound && activeTab === "return" && (
            <div style={{ marginTop: 20, padding: "12px", background: "rgba(26,107,60,0.07)", borderRadius: 10, border: "1px solid rgba(26,107,60,0.15)" }}>
              <div style={{ fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#1a6b3c", marginBottom: 6 }}>Outbound Selected</div>
              <div style={{ fontSize: "0.82rem", fontWeight: 600, color: "var(--ink)" }}>{selectedOutbound.airline.name}</div>
              <div style={{ fontSize: "0.74rem", color: "var(--muted)" }}>{fmtTime(selectedOutbound.dep)} → {fmtTime(selectedOutbound.arr)}</div>
              <div style={{ fontSize: "0.84rem", color: "var(--terra)", fontWeight: 700, marginTop: 4 }}>₹ {selectedOutbound.price?.toLocaleString()}</div>
              <button onClick={() => { setSelectedOutbound(null); setActiveTab("outbound"); }}
                style={{ background: "none", border: "none", fontSize: "0.72rem", color: "var(--muted)", cursor: "pointer", marginTop: 4, fontFamily: "var(--body)" }}>
                Change outbound ×
              </button>
            </div>
          )}
        </div>

        <div className="flight-list">
          {isRoundTrip && (
            <div className="leg-header">
              <span className={`leg-badge ${activeTab}`}>
                {activeTab === "outbound" ? `✈ Outbound · ${searchParams.from} → ${searchParams.to}` : `✈ Return · ${searchParams.to} → ${searchParams.from}`}
              </span>
              <div className="leg-line" />
            </div>
          )}

          {/* ── COMPARE BAR — shows when 2 flights selected ── */}
          {compareList.length === 2 && (
            <div style={{
              background: "var(--brown)", borderRadius: 12, padding: "12px 18px",
              display: "flex", alignItems: "center", justifyContent: "space-between",
              marginBottom: 12,
            }}>
              <div>
                <div style={{ color: "#fff", fontWeight: 700, fontSize: "0.85rem" }}>
                  {compareList[0].airline.name} vs {compareList[1].airline.name}
                </div>
                <div style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.72rem", marginTop: 2 }}>
                  2 flights selected · ready to compare
                </div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={() => { setCompareList([]); setShowCompare(false); }}
                  style={{ background: "none", border: "1px solid rgba(255,255,255,0.25)", color: "rgba(255,255,255,0.6)", borderRadius: 8, padding: "7px 14px", fontSize: "0.78rem", cursor: "pointer", fontFamily: "var(--body)" }}>
                  Clear
                </button>
                <button
                  onClick={() => setShowCompare(true)}
                  style={{ background: "var(--terra)", border: "none", color: "#fff", borderRadius: 8, padding: "7px 18px", fontSize: "0.82rem", fontWeight: 700, cursor: "pointer", fontFamily: "var(--body)" }}>
                  ⚖️ Compare Now
                </button>
              </div>
            </div>
          )}

          {/* ── COMPARE DRAWER ── */}
          {showCompare && compareList.length === 2 && (
            <CompareDrawer
              flights={compareList}
              onClose={() => setShowCompare(false)}
            />
          )}

          {currentLoading ? (
            Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
          ) : currentError ? (
            <div className="state-box">
              <div className="state-icon">✈️</div>
              <div className="state-title">No flights found</div>
              <div className="state-desc">{currentError}</div>
            </div>
          ) : shown.length === 0 ? (
            <div className="state-box">
              <div className="state-icon">🔍</div>
              <div className="state-title">No results match filters</div>
              <div className="state-desc">Try removing some filters to see more options.</div>
            </div>
          ) : (
            shown.map(f => (
              <FlightCard
                key={f.id}
                flight={f}
                onSelect={activeTab === "outbound" ? handleSelectOutbound : handleSelectReturn}
                onToggleCompare={toggleCompare}
                isCompareChecked={!!compareList.find(c => c.id === f.id)}
              />
            ))
          )}

          {compareList.length === 1 && !currentLoading && (
            <div style={{ textAlign: "center", padding: "10px", fontSize: "0.78rem", color: "var(--terra)", fontWeight: 600 }}>
              + Select one more flight to compare
            </div>
          )}

          {isRoundTrip && activeTab === "outbound" && !currentLoading && shown.length > 0 && (
            <div style={{ textAlign: "center", padding: "16px", fontSize: "0.82rem", color: "var(--muted)" }}>
              Select an outbound flight to proceed to return flights →
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── BOOKING PAGE ──────────────────────────────────────────────────────────
// ── BOOKING PAGE ──────────────────────────────────────────────────────────
const colStyle = { gridColumn: "1/-1" };
const emptyStyle = {};

function Field({ label, id, col, errors, children }) {
  return (
    <div className="form-group" style={col ? colStyle : emptyStyle}>
      <label className="form-label">{label}</label>
      {children}
      {errors[id] && (
        <span style={{ fontSize: "0.7rem", color: "var(--terra)" }}>
          {errors[id]}
        </span>
      )}
    </div>
  );
}

function BookingPage({ flight, user, onBack, onBook, onSignIn }) {
  const [pax, setPax] = useState({
    firstName: user?.name?.split(" ")[0]||"",
    lastName:  user?.name?.split(" ")[1]||"",
    email:     user?.email||"",
    phone:"", dob:"", title:"mr", gender:"m"
  });
  const [paymentMethod, setPaymentMethod] = useState("razorpay");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const set = (k,v) => { setPax(p=>({...p,[k]:v})); setErrors(e=>({...e,[k]:""})); };

  const validate = () => {
    const e = {};
    if (!pax.firstName.trim()) e.firstName = "Required";
    if (!pax.lastName.trim())  e.lastName  = "Required";
    if (!pax.email.trim() || !pax.email.includes("@")) e.email = "Valid email required";
    if (!pax.phone.trim() || pax.phone.replace(/\D/g, "").length < 10) e.phone = "Valid phone number required";
    if (!pax.dob) e.dob = "Required";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const taxes = Math.round(flight.price * 0.12);
  const total = Math.round(flight.totalPrice * 1.12);

  const handlePayWithRazorpay = async () => {
    if (!user) { onSignIn(); return; }
    if (!validate()) return;
    setLoading(true);
    try {
      const rzLoaded = await loadRazorpay();
      if (!rzLoaded) { alert("Razorpay failed to load."); setLoading(false); return; }

      const order = await createRazorpayOrder(
        total * 100, "INR", `skybook_${flight.offer_id}_${Date.now()}`
      );

      const options = {
        key: order.key_id,
        amount: order.amount,
        currency: order.currency,
        name: "SkyBook",
        description: `${flight.from} → ${flight.to} | ${flight.airline.name}`,
        image: "https://via.placeholder.com/60x60/c1622f/ffffff?text=✈",
        order_id: order.razorpay_order_id,
        prefill: { name:`${pax.firstName} ${pax.lastName}`, email:pax.email, contact:pax.phone },
        theme: { color: "#c1622f" },
        modal: { ondismiss: () => setLoading(false) },
        handler: async (rzResponse) => {
          try {
            const verified = await verifyRazorpayPayment({
              razorpay_order_id:   rzResponse.razorpay_order_id,
              razorpay_payment_id: rzResponse.razorpay_payment_id,
              razorpay_signature:  rzResponse.razorpay_signature,
            });

            if (!verified.success) {
              alert("Payment verification failed. Please contact support.");
              setLoading(false);
              return;
            }

            let result;
            try {
              result = await confirmBooking(
                flight.offer_id, pax, flight, rzResponse.razorpay_payment_id
              );
            } catch (bookingErr) {
              console.error("Duffel booking error:", bookingErr);
              alert(
                "Payment was successful but booking failed.\n\n" +
                "Error: " + bookingErr.message + "\n\n" +
                "Payment ID: " + rzResponse.razorpay_payment_id + "\n" +
                "Please contact support with your Payment ID."
              );
              setLoading(false);
              return;
            }

            onBook(flight, pax, result.booking, rzResponse.razorpay_payment_id);

          } catch (err) {
            console.error("Handler error:", err);
            alert("Something went wrong: " + err.message);
          } finally {
            setLoading(false);
          }
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.on("payment.failed", (resp) => {
        alert(`Payment failed: ${resp.error.description}`);
        setLoading(false);
      });
      rzp.open();
    } catch (err) {
      alert("Payment error: " + err.message);
      setLoading(false);
    }
  };

  return (
    <div className="page">
      <div className="detail-page">
        <button className="back-btn" onClick={onBack}>← Back to results</button>
        {flight.isRoundTrip && (
          <div style={{background:"rgba(26,107,60,0.07)",border:"1px solid rgba(26,107,60,0.15)",borderRadius:12,padding:"12px 18px",marginBottom:20,fontSize:"0.84rem",color:"#1a6b3c",fontWeight:500}}>
            🔄 Round Trip — Outbound + Return selected
          </div>
        )}
        <div className="detail-grid">
          {/* ── LEFT COLUMN ── */}
          <div>
            {/* Flight Details card */}
            <div className="detail-card" style={{marginBottom:20}}>
              <div className="detail-title">Flight Details{flight.isRoundTrip ? " — Outbound" : ""}</div>
              <div className="detail-route">
                <div className="dr-point">
                  <div className="dr-iata">{flight.from}</div>
                  <div className="dr-city">{CITY_MAP[flight.from]||flight.from}</div>
                  <div className="dr-time">{fmtTime(flight.dep)}</div>
                </div>
                <div className="dr-mid">
                  <div className="dr-dur">{flight.duration}</div>
                  <div className="dr-plane">✈</div>
                  <div style={{fontSize:"0.72rem",color:"var(--muted)"}}>{flight.stops===0?"Non-stop":`${flight.stops} stop`}</div>
                </div>
                <div className="dr-point">
                  <div className="dr-iata">{flight.to}</div>
                  <div className="dr-city">{CITY_MAP[flight.to]||flight.to}</div>
                  <div className="dr-time">{fmtTime(flight.arr)}</div>
                </div>
              </div>
              {flight.isRoundTrip && flight.returnFlight && (
                <>
                  <div style={{textAlign:"center",fontSize:"0.75rem",color:"var(--muted)",padding:"6px 0",borderTop:"1px solid var(--cream2)",borderBottom:"1px solid var(--cream2)",margin:"8px 0"}}>
                    ↩ Return Flight
                  </div>
                  <div className="detail-route" style={{marginBottom:0}}>
                    <div className="dr-point">
                      <div className="dr-iata">{flight.returnFlight.from}</div>
                      <div className="dr-city">{CITY_MAP[flight.returnFlight.from]||flight.returnFlight.from}</div>
                      <div className="dr-time">{fmtTime(flight.returnFlight.dep)}</div>
                    </div>
                    <div className="dr-mid">
                      <div className="dr-dur">{flight.returnFlight.duration}</div>
                      <div className="dr-plane">✈</div>
                      <div style={{fontSize:"0.72rem",color:"var(--muted)"}}>{flight.returnFlight.stops===0?"Non-stop":`${flight.returnFlight.stops} stop`}</div>
                    </div>
                    <div className="dr-point">
                      <div className="dr-iata">{flight.returnFlight.to}</div>
                      <div className="dr-city">{CITY_MAP[flight.returnFlight.to]||flight.returnFlight.to}</div>
                      <div className="dr-time">{fmtTime(flight.returnFlight.arr)}</div>
                    </div>
                  </div>
                </>
              )}
              <div className="detail-info-grid" style={{marginTop:16}}>
                {[
                  ["Airline",    flight.airline.name],
                  ["Class",      flight.class],
                  ["Baggage",    flight.baggage],
                  ["Refundable", flight.refundable?"Yes ✓":"No"],
                ].map(([k,v]) => (
                  <div key={k} className="info-item">
                    <div className="info-key">{k}</div>
                    <div className="info-val">{v}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Passenger Details card */}
            <div className="detail-card">
              <div className="detail-title">Passenger Details</div>
              {!user && (
                <div style={{background:"rgba(193,98,47,0.07)",border:"1.5px solid rgba(193,98,47,0.2)",borderRadius:10,padding:"14px 16px",marginBottom:16,fontSize:"0.84rem",color:"var(--brown)",lineHeight:1.6}}>
                  🔐 <strong>Sign in required to complete booking.</strong>
                  <button onClick={onSignIn} style={{display:"block",marginTop:6,color:"var(--terra)",fontWeight:700,background:"none",border:"none",cursor:"pointer",fontSize:"0.84rem",fontFamily:"var(--body)"}}>
                    Continue with Google →
                  </button>
                </div>
              )}
              <div className="pax-form">
                <Field label="Title" id="title" errors={errors}>
                  <select className="form-input" value={pax.title} onChange={e=>set("title",e.target.value)}>
                    <option value="mr">Mr</option>
                    <option value="ms">Ms</option>
                    <option value="mrs">Mrs</option>
                  </select>
                </Field>
                <Field label="Gender" id="gender" errors={errors}>
                  <select className="form-input" value={pax.gender} onChange={e=>set("gender",e.target.value)}>
                    <option value="m">Male</option>
                    <option value="f">Female</option>
                  </select>
                </Field>
                <Field label="First Name" id="firstName" errors={errors}>
                  <input
                    className="form-input"
                    placeholder="Arjun"
                    value={pax.firstName}
                    onChange={e=>set("firstName",e.target.value)}
                    style={errors.firstName ? {borderColor:"var(--terra)"} : {}}
                  />
                </Field>
                <Field label="Last Name" id="lastName" errors={errors}>
                  <input
                    className="form-input"
                    placeholder="Sharma"
                    value={pax.lastName}
                    onChange={e=>set("lastName",e.target.value)}
                    style={errors.lastName ? {borderColor:"var(--terra)"} : {}}
                  />
                </Field>
                <Field label="Date of Birth" id="dob" col errors={errors}>
                  <input
                    type="date"
                    className="form-input"
                    value={pax.dob}
                    onChange={e=>set("dob",e.target.value)}
                    style={errors.dob ? {borderColor:"var(--terra)"} : {}}
                  />
                </Field>
                <Field label="Email Address" id="email" col errors={errors}>
                  <input
                    type="email"
                    className="form-input"
                    placeholder="arjun@email.com"
                    value={pax.email}
                    onChange={e=>set("email",e.target.value)}
                    style={errors.email ? {borderColor:"var(--terra)"} : {}}
                  />
                </Field>
                <Field label="Phone Number" id="phone" col errors={errors}>
                  <input
                    type="tel"
                    className="form-input"
                    placeholder="+91 98765 43210"
                    value={pax.phone}
                    onChange={e=>set("phone",e.target.value)}
                    style={errors.phone ? {borderColor:"var(--terra)"} : {}}
                  />
                </Field>
              </div>
            </div>

            <PaymentSection
              paymentMethod={paymentMethod}
              setPaymentMethod={setPaymentMethod}
              user={user}
            />
          </div>

          {/* ── RIGHT COLUMN ── */}
          <div>
            <BookingSummaryCard
              flight={flight}
              taxes={taxes}
              total={total}
              loading={loading}
              handlePayWithRazorpay={handlePayWithRazorpay}
              user={user}
              onSignIn={onSignIn}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function ConfirmPage({ booking, onHome }) {
  const ref = booking.bookingData?.booking_reference ||
    booking.bookingData?.booking_id ||
    `SKY-${Math.random().toString(36).slice(2,8).toUpperCase()}`;

  const downloadPDF = () => {
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
    script.onload = () => {
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const W = 210;
      const margin = 18;

      doc.setFillColor(93, 46, 28);
      doc.rect(0, 0, W, 38, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(22);
      doc.setFont("helvetica", "bold");
      doc.text("✈  SkyBook", margin, 18);
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(210, 180, 160);
      doc.text("AI-Powered Flight Booking", margin, 26);
      doc.setFontSize(10);
      doc.setTextColor(255, 220, 180);
      doc.text("BOOKING CONFIRMED  ✔", W - margin, 20, { align: "right" });
      doc.setFontSize(8);
      doc.setTextColor(200, 170, 140);
      doc.text(`Generated: ${new Date().toLocaleString("en-IN")}`, W - margin, 28, { align: "right" });

      doc.setFillColor(255, 248, 240);
      doc.setDrawColor(193, 98, 47);
      doc.setLineWidth(0.5);
      doc.roundedRect(margin, 46, W - margin * 2, 22, 3, 3, "FD");
      doc.setTextColor(120, 60, 20);
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.text("BOOKING REFERENCE", margin + 6, 55);
      doc.setFontSize(18);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(193, 98, 47);
      doc.text(ref, margin + 6, 64);
      if (booking.paymentId) {
        doc.setFontSize(7.5);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(140, 100, 70);
        doc.text(`Payment ID: ${booking.paymentId}`, W - margin - 4, 64, { align: "right" });
      }

      let y = 78;
      const sectionTitle = (title) => {
        doc.setFillColor(245, 235, 225);
        doc.rect(margin, y, W - margin * 2, 8, "F");
        doc.setFontSize(8);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(120, 60, 20);
        doc.text(title.toUpperCase(), margin + 4, y + 5.5);
        y += 12;
      };
      const row = (label, value, bold = false) => {
        doc.setFontSize(8.5);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(130, 100, 80);
        doc.text(label, margin + 4, y);
        doc.setFont("helvetica", bold ? "bold" : "normal");
        doc.setTextColor(40, 25, 15);
        doc.text(String(value || "—"), margin + 70, y);
        doc.setDrawColor(230, 215, 200);
        doc.setLineWidth(0.2);
        doc.line(margin, y + 2, W - margin, y + 2);
        y += 9;
      };

      sectionTitle("✈  Flight Details");
      row("Airline", booking.flight.airline?.name);
      row("Flight Class", booking.flight.class);
      row("Route", `${booking.flight.from}  →  ${booking.flight.to}`);
      row("Departure", `${fmtTime(booking.flight.dep)}  ·  ${fmtDate(booking.flight.dep)}`);
      row("Arrival", `${fmtTime(booking.flight.arr)}  ·  ${fmtDate(booking.flight.arr)}`);
      row("Duration", booking.flight.duration);
      row("Stops", booking.flight.stops === 0 ? "Non-stop" : `${booking.flight.stops} stop(s)`);
      row("Baggage Allowance", booking.flight.baggage || "15 kg");
      row("Refundable", booking.flight.refundable ? "Yes" : "No");

      y += 4;
      sectionTitle("👤  Passenger Details");
      row("Full Name", `${booking.pax.firstName} ${booking.pax.lastName}`);
      row("Title", booking.pax.title?.toUpperCase() || "MR");
      row("Gender", booking.pax.gender === "m" ? "Male" : "Female");
      row("Date of Birth", booking.pax.dob || "—");
      row("Email", booking.pax.email);
      row("Phone", booking.pax.phone);

      y += 4;
      sectionTitle("💰  Fare Breakdown");
      const base  = booking.flight.price || 0;
      const taxes = Math.round(base * 0.12);
      const total = Math.round(booking.flight.totalPrice * 1.12);
      const pax   = booking.flight.pax || 1;
      row("Base Fare (per person)", `INR ${Number(base).toLocaleString("en-IN")}`);
      row("Taxes & Fees (12%)", `INR ${Number(taxes).toLocaleString("en-IN")}`);
      row("Passengers", `x ${pax}`);
      doc.setFillColor(255, 248, 240);
      doc.setDrawColor(193, 98, 47);
      doc.setLineWidth(0.4);
      doc.roundedRect(margin, y - 1, W - margin * 2, 10, 2, 2, "FD");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9.5);
      doc.setTextColor(120, 60, 20);
      doc.text("Total Paid", margin + 4, y + 6);
      doc.setTextColor(193, 98, 47);
      doc.text(`INR ${Number(total).toLocaleString("en-IN")}`, W - margin - 4, y + 6, { align: "right" });
      y += 16;

      y += 4;
      sectionTitle("📋  Booking Information");
      row("Booking Reference", ref, true);
      row("Duffel Order ID", booking.bookingData?.duffel_order_id || "—");
      row("Status", "CONFIRMED ✔", true);
      row("Booked On", new Date().toLocaleDateString("en-IN", { day:"2-digit", month:"long", year:"numeric" }));

      doc.setFillColor(93, 46, 28);
      doc.rect(0, 277, W, 20, "F");
      doc.setTextColor(200, 170, 140);
      doc.setFontSize(7.5);
      doc.setFont("helvetica", "normal");
      doc.text("SkyBook · AI-Powered Flight Booking · Secured by Razorpay & Duffel", W / 2, 285, { align: "center" });
      doc.text("This is a computer-generated document. No signature required.", W / 2, 291, { align: "center" });

      doc.save(`SkyBook_${ref}.pdf`);
    };
    document.body.appendChild(script);
  };

  return (
    <div className="page">
      <div className="confirm-page">
        <div className="confirm-icon">🎉</div>
        <div className="confirm-title">Booking Confirmed!</div>
        <div className="confirm-sub">
          Your flight has been booked successfully.<br/>
          A confirmation will be sent to <strong>{booking.pax.email}</strong>
        </div>
        <div className="confirm-card">
          <div className="booking-label">Booking Reference</div>
          <div className="booking-id">{ref}</div>
          {booking.paymentId && (
            <div style={{fontSize:"0.74rem",color:"var(--muted)",marginTop:4,marginBottom:16}}>
              Payment ID: {booking.paymentId}
            </div>
          )}
          <div style={{marginTop:20,display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            {[
              ["Flight",      booking.flight.airline.name],
              ["Route",       `${booking.flight.from} → ${booking.flight.to}`],
              ["Departure",   fmtTime(booking.flight.dep)],
              ["Date",        fmtDate(booking.flight.dep)],
              ["Arrival",     fmtTime(booking.flight.arr)],
              ["Duration",    booking.flight.duration],
              ["Stops",       booking.flight.stops === 0 ? "Non-stop" : `${booking.flight.stops} stop`],
              ["Class",       booking.flight.class],
              ["Baggage",     booking.flight.baggage || "15 kg"],
              ["Passenger",   `${booking.pax.firstName} ${booking.pax.lastName}`],
              ["Email",       booking.pax.email],
              ["Phone",       booking.pax.phone],
              ["Status",      "✅ Confirmed"],
              ["Total Paid",  `₹ ${Math.round(booking.flight.totalPrice * 1.12).toLocaleString()}`],
            ].map(([k,v]) => (
              <div key={k} className="info-item">
                <div className="info-key">{k}</div>
                <div className="info-val">{v}</div>
              </div>
            ))}
          </div>
        </div>

        <button
          onClick={downloadPDF}
          style={{
            marginTop: 20,
            background: "linear-gradient(135deg, #5d2e1c, #c1622f)",
            color: "#fff",
            border: "none",
            borderRadius: 12,
            padding: "14px 32px",
            fontSize: "1rem",
            fontWeight: 700,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 10,
            fontFamily: "var(--body)",
            boxShadow: "0 4px 16px rgba(193,98,47,0.35)",
          }}
        >
          📄 Download Booking PDF
        </button>

        <button
          className="btn-hero btn-hero-primary"
          onClick={onHome}
          style={{ marginTop: 12 }}
        >
          ✈️ Book Another Flight
        </button>
      </div>
    </div>
  );
}
// ── ROOT APP ──────────────────────────────────────────────────────────────
export default function SkyBook() {
  const [page, setPage] = useState("home");
  const [user, setUser] = useState(null);
  const [showAuth, setShowAuth] = useState(false);
  const [searchParams, setSearchParams] = useState(null);
  const [selectedFlight, setSelectedFlight] = useState(null);
  const [booking, setBooking] = useState(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("skybook_user");
      if (saved) setUser(JSON.parse(saved));
    } catch {}
  }, []);

  const handleSignIn = (userData) => {
    setUser(userData);
    try { localStorage.setItem("skybook_user", JSON.stringify(userData)); } catch {}
  };

  const handleSignOut = () => {
    setUser(null);
    try { localStorage.removeItem("skybook_user"); } catch {}
    if (window.google?.accounts?.id) window.google.accounts.id.disableAutoSelect();
  };

  const handleSearch = (params) => { setSearchParams(params); setPage("results"); window.scrollTo(0,0); };
  const handleSelect = (flight) => { setSelectedFlight(flight); setPage("booking"); window.scrollTo(0,0); };
  const handleBook   = (flight, pax, bookingData, paymentId) => {
    setBooking({ flight, pax, bookingData, paymentId });
    setPage("confirm"); window.scrollTo(0,0);
  };
  const goHome = () => { setPage("home"); window.scrollTo(0,0); };

  return (
    <>
      <GlobalStyles/>
      <Nav user={user} onSignIn={() => setShowAuth(true)} onSignOut={handleSignOut} onHome={goHome}/>

      {page==="home" && <LandingPage onSearch={handleSearch} onSignIn={() => setShowAuth(true)}/>}
      {page==="results" && searchParams && (
        <ResultsPage searchParams={searchParams} onSelect={handleSelect} onBack={goHome} onSearch={handleSearch}/>
      )}
      {page==="booking" && selectedFlight && (
        <BookingPage
          flight={selectedFlight} user={user}
          onBack={() => setPage("results")}
          onBook={handleBook}
          onSignIn={() => setShowAuth(true)}
        />
      )}
      {page==="confirm" && booking && (
        <ConfirmPage booking={booking} onHome={goHome}/>
      )}

      {showAuth && (
        <SignInModal onClose={() => setShowAuth(false)} onSignIn={handleSignIn}/>
      )}

      <PricePredictorAgent/>
      <AiChat/>
    </>
  );
}