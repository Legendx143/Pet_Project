import { useEffect, useState } from "react";
import { isSupabaseConfigured, supabase } from "./supabaseClient.js";

const petSlides = [
  {
    name: "Milo",
    type: "Cat · Wellness check",
    note: "A clear photo can help capture visible changes worth discussing with a vet.",
    image:
      "https://images.unsplash.com/photo-1511044568932-338cba0ad803?auto=format&fit=crop&w=1400&q=85",
  },
  {
    name: "Luna",
    type: "Cat · At-home observation",
    note: "Track appetite, energy, and changes over time in one simple check-in.",
    image:
      "https://images.unsplash.com/photo-1573865526739-10659fec78a5?auto=format&fit=crop&w=1400&q=85",
  },
  {
    name: "Nala",
    type: "Cat · Symptom timeline",
    note: "Small details become more useful when they are connected to a timeline.",
    image:
      "https://images.unsplash.com/photo-1495360010541-f48722b34f7d?auto=format&fit=crop&w=1400&q=85",
  },
  {
    name: "Cooper",
    type: "Dog · Health snapshot",
    note: "Describe what changed in your own words or simply speak it aloud.",
    image:
      "https://images.unsplash.com/photo-1552053831-71594a27632d?auto=format&fit=crop&w=1400&q=85",
  },
  {
    name: "Bailey",
    type: "Dog · Guided check-in",
    note: "Get thoughtful follow-up questions when more information is needed.",
    image:
      "https://images.unsplash.com/photo-1517849845537-4d257902454a?auto=format&fit=crop&w=1400&q=85",
  },
  {
    name: "Teddy",
    type: "Dog · Vet-ready summary",
    note: "Bring a structured overview of symptoms and observations to your visit.",
    image:
      "https://images.unsplash.com/photo-1537151608828-ea2b11777ee8?auto=format&fit=crop&w=1400&q=85",
  },
];

const aboutItems = [
  {
    icon: "⌁",
    title: "Speak naturally",
    text: "Share a symptom in text or voice, just as you would describe it to someone you trust.",
  },
  {
    icon: "◉",
    title: "Add visual context",
    text: "Optionally include a photo when a visible change may help complete the picture.",
  },
  {
    icon: "↗",
    title: "Follow the story",
    text: "Capture when something started, how it changed, and the signals you have noticed since.",
  },
  {
    icon: "✦",
    title: "Understand the next step",
    text: "Receive possible explanations, supporting evidence, and a clear level of care to consider.",
  },
];

const reasons = [
  {
    number: "01",
    title: "Clear, not cryptic",
    text: "See the observations that influenced each possible condition—so the result feels understandable, not like a black box.",
  },
  {
    number: "02",
    title: "Built around your pet",
    text: "Adaptive questions focus only on what is still unknown, creating a calmer alternative to long, generic forms.",
  },
  {
    number: "03",
    title: "A practical plan",
    text: "Know whether to monitor, arrange a consultation, or seek urgent care—and get gentle supportive-care guidance when appropriate.",
  },
  {
    number: "04",
    title: "Ready for the vet",
    text: "Turn your observations into a concise, shareable summary that helps start a more informed veterinary conversation.",
  },
];

function Arrow({ direction = "right" }) {
  return <span className={`arrow arrow-${direction}`} aria-hidden="true">→</span>;
}

function EyeIcon({ visible }) {
  if (visible) {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
        <line x1="1" y1="1" x2="23" y2="23" />
      </svg>
    );
  }
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export default function PetCareLanding() {
  const [activeSlide, setActiveSlide] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [registerError, setRegisterError] = useState("");
  const [loginNotice, setLoginNotice] = useState("");
  const [loginSubmitting, setLoginSubmitting] = useState(false);
  const [registerSubmitting, setRegisterSubmitting] = useState(false);
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const goToSlide = (index) => {
    setActiveSlide((index + petSlides.length) % petSlides.length);
  };

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActiveSlide((current) => (current + 1) % petSlides.length);
    }, 5200);

    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const sections = document.querySelectorAll(".reveal-section");
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("section-visible");
          } else {
            entry.target.classList.remove("section-visible");
          }
        });
      },
      { threshold: 0.16 },
    );

    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!loginOpen && !registerOpen) return undefined;

    const closeOnEscape = (event) => {
      if (event.key === "Escape") {
        setLoginOpen(false);
        setRegisterOpen(false);
        setShowLoginPassword(false);
        setShowRegisterPassword(false);
        setShowConfirmPassword(false);
      }
    };

    document.addEventListener("keydown", closeOnEscape);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", closeOnEscape);
      document.body.style.overflow = "";
    };
  }, [loginOpen, registerOpen]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("emailConfirmed") !== "1") return;

    setLoginNotice("Your email is confirmed. You can log in now.");
    setLoginOpen(true);
    window.history.replaceState({}, "", window.location.pathname);
  }, []);

  const closeMenu = () => setMenuOpen(false);
  const openLogin = (event) => {
    event.preventDefault();
    closeMenu();
    setRegisterOpen(false);
    setLoginError("");
    setLoginNotice("");
    setShowLoginPassword(false);
    setLoginOpen(true);
  };
  const openRegister = (event) => {
    event.preventDefault();
    closeMenu();
    setLoginOpen(false);
    setRegisterError("");
    setShowRegisterPassword(false);
    setShowConfirmPassword(false);
    setRegisterOpen(true);
  };
  const closeModals = () => {
    setLoginOpen(false);
    setRegisterOpen(false);
    setShowLoginPassword(false);
    setShowRegisterPassword(false);
    setShowConfirmPassword(false);
  };
  const isValidEmail = (email) => /^\S+@\S+\.\S+$/.test(email);
  const handleLoginSubmit = async (event) => {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    const email = String(fields.get("identity") || "").trim().toLowerCase();
    const password = String(fields.get("password") || "");

    if (!isValidEmail(email)) {
      setLoginError("Enter a valid email");
      return;
    }
    if (!password) {
      setLoginError("Enter your password");
      return;
    }

    setLoginSubmitting(true);
    setLoginError("");

    if (!isSupabaseConfigured || !supabase) {
      // Demo mode fallback when real Supabase keys are not set
      try {
        const users = JSON.parse(localStorage.getItem("petcare_demo_users") || "[]");
        const match = users.find((u) => u.email === email && u.password === password);
        if (!match) {
          setLoginError("Login Credentials Not Matched");
          return;
        }
        const demoSession = {
          user: { id: match.id, email: match.email },
          access_token: "demo-token-" + match.id,
        };
        localStorage.setItem("petcare_demo_session", JSON.stringify(demoSession));
        window.location.assign("/dashboard");
      } catch {
        setLoginError("Login Credentials Not Matched");
      } finally {
        setLoginSubmitting(false);
      }
      return;
    }

    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        if (/failed to fetch/i.test(error.message)) {
          setLoginError("Unable to connect to Supabase. Check your connection or Supabase URL in .env.local.");
        } else {
          setLoginError(
            /email not confirmed/i.test(error.message)
              ? "Please confirm your email before logging in."
              : error.message || "Login Credentials Not Matched",
          );
        }
        return;
      }
      window.location.assign("/dashboard");
    } catch {
      setLoginError("Login Credentials Not Matched");
    } finally {
      setLoginSubmitting(false);
    }
  };
  const handleRegisterSubmit = async (event) => {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    const email = String(fields.get("register-identity") || "").trim().toLowerCase();
    const password = String(fields.get("register-password") || "");
    const confirmation = String(fields.get("confirm-password") || "");

    if (!isValidEmail(email)) {
      setRegisterError("Enter a valid email");
      return;
    }
    if (!password || !confirmation) {
      setRegisterError("Fill in all password fields");
      return;
    }
    if (password.length < 6) {
      setRegisterError("Password must be at least 6 characters long");
      return;
    }
    if (password !== confirmation) {
      setRegisterError("Passwords do not match");
      return;
    }

    setRegisterSubmitting(true);
    setRegisterError("");

    if (!isSupabaseConfigured || !supabase) {
      // Demo mode registration fallback when Supabase keys are not set
      try {
        const users = JSON.parse(localStorage.getItem("petcare_demo_users") || "[]");
        const existing = users.find((u) => u.email === email);
        if (existing) {
          setRegisterError("User already registered with this email");
          return;
        }
        const newUser = { id: crypto.randomUUID(), email, password, created_at: new Date().toISOString() };
        users.push(newUser);
        localStorage.setItem("petcare_demo_users", JSON.stringify(users));

        setRegisterError("");
        setRegisterOpen(false);
        setLoginError("");
        setLoginNotice(`Account created for ${email} (Demo Mode). You can now log in.`);
        setLoginOpen(true);
      } catch (e) {
        setRegisterError("Could not create local demo account.");
      } finally {
        setRegisterSubmitting(false);
      }
      return;
    }

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (error) {
        const errorMsg = error.message || String(error);
        if (/failed to fetch/i.test(errorMsg) || errorMsg === "TypeError: Failed to fetch") {
          setRegisterError("Unable to connect to Supabase. Check your connection or Supabase URL in .env.local.");
        } else {
          setRegisterError(errorMsg);
        }
        return;
      }

      setRegisterError("");
      setRegisterOpen(false);
      setLoginError("");

      if (data?.session) {
        window.location.assign("/dashboard");
      } else {
        setLoginNotice(`We sent a confirmation email to ${email}. Confirm it, then log in.`);
        setLoginOpen(true);
      }
    } catch (err) {
      const errorMsg = err?.message || String(err);
      if (/failed to fetch/i.test(errorMsg) || errorMsg === "TypeError: Failed to fetch") {
        setRegisterError("Unable to connect to Supabase. Check your connection or Supabase URL in .env.local.");
      } else {
        setRegisterError("We could not create your account. Please try again.");
      }
    } finally {
      setRegisterSubmitting(false);
    }
  };
  const revealSection = (sectionId) => (event) => {
    event.preventDefault();
    closeMenu();

    const section = document.getElementById(sectionId);
    if (!section) return;

    section.classList.remove("section-visible");
    void section.offsetWidth;
    section.scrollIntoView({ behavior: "smooth", block: "start" });
    window.setTimeout(() => section.classList.add("section-visible"), 420);
  };
  const activePet = petSlides[activeSlide];

  return (
    <div className="pet-care-page">
      <style>{styles}</style>

      <header className="site-header">
        <a className="brand" href="#top" aria-label="Pet-Care home" onClick={closeMenu}>
          <img src="/pet-care-logo.png" alt="Pet-Care Logo" className="brand-logo-img" />
          <span>Pet-Care</span>
        </a>

        <button
          className="menu-toggle"
          type="button"
          aria-label="Toggle navigation"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
        >
          <span />
          <span />
        </button>

        <nav className={menuOpen ? "main-nav nav-open" : "main-nav"} aria-label="Main navigation">
          <a href="#about" onClick={revealSection("about")}>About</a>
          <a href="#why-pet-care" onClick={revealSection("why-pet-care")}>Why Pet-Care</a>
          <span className="nav-divider" aria-hidden="true" />
          <a className="login-link" href="#login" onClick={openLogin}>Log in</a>
          <a className="register-link" href="#register" onClick={openRegister}>
            Register <Arrow />
          </a>
        </nav>
      </header>

      <main id="top">
        <section className="hero" aria-labelledby="hero-title">
          <div className="hero-copy">
            <p className="eyebrow"><span className="pulse-dot" /> PET HEALTH, MADE CLEARER</p>
            <h1 id="hero-title">Every small signal deserves a thoughtful next step</h1>
            <p className="hero-description">
              Pet-Care turns your observations, photos, voice notes, and symptom timeline into clear, compassionate guidance for your<br />pet
            </p>

            <a className="text-button hero-scroll-link" href="#about" onClick={revealSection("about")}>
              Explore how Pet-Care works <span aria-hidden="true">↓</span>
            </a>

            <div className="input-pills" aria-label="Information Pet-Care can understand">
              <span>Voice notes</span>
              <span>Photos</span>
              <span>Symptom timeline</span>
            </div>
          </div>

          <div className="showcase" aria-label="Pet gallery">
            <div className="showcase-glow" aria-hidden="true" />
            <div className="gallery-card">
              <div className="gallery-topbar">
                <span className="gallery-live"><i /> PET STORY</span>
                <span>{String(activeSlide + 1).padStart(2, "0")} / {String(petSlides.length).padStart(2, "0")}</span>
              </div>

              <div className="image-wrap">
                {petSlides.map((pet, index) => (
                  <img
                    className={index === activeSlide ? "pet-image image-active" : "pet-image"}
                    src={pet.image}
                    alt={`${pet.name}, ${pet.type.toLowerCase()}`}
                    key={pet.name}
                  />
                ))}
                <div className="image-shade" />
                <div className="pet-caption">
                  <p>{activePet.type}</p>
                  <h2>{activePet.name}</h2>
                </div>
              </div>

              <div className="gallery-bottom">
                <p>{activePet.note}</p>
                <div className="gallery-controls">
                  <button type="button" onClick={() => goToSlide(activeSlide - 1)} aria-label="Previous pet">←</button>
                  <div className="slide-dots" aria-label="Choose gallery photo">
                    {petSlides.map((pet, index) => (
                      <button
                        className={index === activeSlide ? "dot dot-active" : "dot"}
                        type="button"
                        key={pet.name}
                        onClick={() => goToSlide(index)}
                        aria-label={`Show ${pet.name}`}
                        aria-current={index === activeSlide ? "true" : undefined}
                      />
                    ))}
                  </div>
                  <button type="button" onClick={() => goToSlide(activeSlide + 1)} aria-label="Next pet">→</button>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="signal-strip" aria-label="Triage levels">
          <p>From “something seems off” to a clearer path forward.</p>
          <div className="triage-labels">
            <span><i className="monitor-dot" /> Monitor</span>
            <span><i className="consult-dot" /> Consult</span>
            <span><i className="urgent-dot" /> Urgent</span>
          </div>
        </section>

        <section className="about-section section reveal-section" id="about" aria-labelledby="about-title">
          <div className="section-intro">
            <p className="eyebrow">HOW PET-CARE HELPS</p>
            <h2 id="about-title">A calm way to make sense of what you’re seeing.</h2>
            <p>
              Caring for a pet often starts with a question. Pet-Care helps you gather the useful details, understand possible patterns, and decide what to do next.
            </p>
          </div>

          <ul className="about-grid">
            {aboutItems.map((item) => (
              <li className="about-card" key={item.title}>
                <span className="card-icon" aria-hidden="true">{item.icon}</span>
                <div>
                  <h3>{item.title}</h3>
                  <p>{item.text}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="why-section section reveal-section" id="why-pet-care" aria-labelledby="why-title">
          <div className="why-heading">
            <p className="eyebrow eyebrow-light">WHY PET-CARE</p>
            <h2 id="why-title">Reassurance is better when it comes with reasons.</h2>
            <p>
              Designed to make the first health conversation less overwhelming—without replacing the care and judgment of a veterinarian.
            </p>
            <a className="outline-button" href="#register" onClick={openRegister}>Meet Pet-Care <Arrow /></a>
          </div>

          <ol className="reasons-list">
            {reasons.map((reason) => (
              <li className="reason" key={reason.number}>
                <span className="reason-number">{reason.number}</span>
                <div>
                  <h3>{reason.title}</h3>
                  <p>{reason.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="care-note" aria-label="Important care note">
          <span className="care-note-icon" aria-hidden="true">+</span>
          <p><strong>For your pet’s safety:</strong> Pet-Care offers informational guidance, not a diagnosis. If your pet is in immediate distress, contact an emergency veterinarian right away.</p>
        </section>
      </main>

      <footer className="site-footer">
        <a className="brand footer-brand" href="#top"><img src="/pet-care-logo.png" alt="Pet-Care Logo" className="brand-logo-img" /> Pet-Care</a>
        <p>Better questions. Kinder care.</p>
        <span>© 2026 Pet-Care</span>
      </footer>

      {loginOpen && (
        <div className="modal-backdrop" role="presentation" onMouseDown={closeModals}>
          <section
            className="login-modal"
            aria-labelledby="login-title"
            aria-modal="true"
            role="dialog"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button className="modal-close" type="button" onClick={closeModals} aria-label="Close login window">×</button>
            <span className="modal-paw" aria-hidden="true">✦</span>
            <p className="modal-kicker">PET-CARE ACCOUNT</p>
            <h2 id="login-title">Welcome back.</h2>
            <p className="modal-description">Sign in to continue caring for your pet with clarity.</p>

            <form className="login-form" onSubmit={handleLoginSubmit} noValidate>
              <label htmlFor="login-identity">Email</label>
              <input id="login-identity" name="identity" type="email" autoComplete="email" placeholder="you@example.com" onChange={() => setLoginError("")} />

              <div className="password-label-row">
                <label htmlFor="login-password">Password</label>
                <a href="#forgot-password">Forgot password?</a>
              </div>
              <div className="password-input-wrapper">
                <input
                  id="login-password"
                  name="password"
                  type={showLoginPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  onChange={() => setLoginError("")}
                />
                <button
                  type="button"
                  className="password-toggle-btn"
                  onClick={() => setShowLoginPassword((prev) => !prev)}
                  aria-label={showLoginPassword ? "Hide password" : "Show password"}
                  title={showLoginPassword ? "Hide password" : "Show password"}
                >
                  <EyeIcon visible={showLoginPassword} />
                </button>
              </div>

              {loginNotice && <p className="form-notice" role="status">{loginNotice}</p>}
              {loginError && <p className="form-error" role="alert">{loginError}</p>}

              <button className="login-submit" type="submit" disabled={loginSubmitting}>{loginSubmitting ? "Logging in…" : <>Log in <Arrow /></>}</button>
            </form>

            <p className="new-user">New user? <a href="#register" onClick={openRegister}>Create an account</a></p>
          </section>
        </div>
      )}

      {registerOpen && (
        <div className="modal-backdrop" role="presentation" onMouseDown={closeModals}>
          <section
            className="login-modal register-modal"
            aria-labelledby="register-title"
            aria-modal="true"
            role="dialog"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button className="modal-close" type="button" onClick={closeModals} aria-label="Close registration window">×</button>
            <span className="modal-paw" aria-hidden="true">✦</span>
            <p className="modal-kicker">PET-CARE ACCOUNT</p>
            <h2 id="register-title">Care starts with understanding.</h2>
            <p className="modal-description">Create your account and keep every pet-health observation in one clear place.</p>

            <form className="login-form" onSubmit={handleRegisterSubmit} noValidate>
              <label htmlFor="register-identity">Email</label>
              <input id="register-identity" name="register-identity" type="email" autoComplete="email" placeholder="you@example.com" onChange={() => setRegisterError("")} />

              <label htmlFor="register-password">Password</label>
              <div className="password-input-wrapper">
                <input
                  id="register-password"
                  name="register-password"
                  type={showRegisterPassword ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder="Create a password"
                  onChange={() => setRegisterError("")}
                />
                <button
                  type="button"
                  className="password-toggle-btn"
                  onClick={() => setShowRegisterPassword((prev) => !prev)}
                  aria-label={showRegisterPassword ? "Hide password" : "Show password"}
                  title={showRegisterPassword ? "Hide password" : "Show password"}
                >
                  <EyeIcon visible={showRegisterPassword} />
                </button>
              </div>

              <label htmlFor="confirm-password">Confirm password</label>
              <div className="password-input-wrapper">
                <input
                  id="confirm-password"
                  name="confirm-password"
                  type={showConfirmPassword ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder="Confirm your password"
                  onChange={() => setRegisterError("")}
                />
                <button
                  type="button"
                  className="password-toggle-btn"
                  onClick={() => setShowConfirmPassword((prev) => !prev)}
                  aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                  title={showConfirmPassword ? "Hide password" : "Show password"}
                >
                  <EyeIcon visible={showConfirmPassword} />
                </button>
              </div>

              {registerError && <p className="form-error" role="alert">{registerError}</p>}

              <button className="login-submit" type="submit" disabled={registerSubmitting}>{registerSubmitting ? "Creating account…" : <>Create account <Arrow /></>}</button>
            </form>

            <p className="new-user">Already a member? <a href="#login" onClick={openLogin}>Log in</a></p>
          </section>
        </div>
      )}

    </div>
  );
}

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&family=Fraunces:opsz,wght@9..144,500;9..144,600&display=swap');

  :root {
    --ink: #183832;
    --deep-ink: #102c27;
    --pine: #24654f;
    --mint: #d9f1de;
    --cream: #f8f5ec;
    --paper: #fffdf8;
    --coral: #f2765c;
    --muted: #61736e;
    --line: rgba(24, 56, 50, .14);
  }

  * { box-sizing: border-box; }
  html { scroll-behavior: smooth; }
  body { margin: 0; }
  .pet-care-page { overflow: hidden; background: var(--paper); color: var(--ink); font-family: 'DM Sans', Arial, sans-serif; }
  .pet-care-page a { color: inherit; text-decoration: none; }
  .pet-care-page button { font: inherit; }

  .site-header { align-items: center; background: rgba(255, 253, 248, .94); border-bottom: 1px solid rgba(24, 56, 50, .08); display: flex; height: 78px; justify-content: space-between; left: 0; padding: 0 clamp(24px, 5.5vw, 92px); position: fixed; right: 0; top: 0; z-index: 20; backdrop-filter: blur(12px); }
  .brand { align-items: center; display: inline-flex; font-size: 20px; font-weight: 700; gap: 9px; letter-spacing: -.7px; }
  .brand-mark { align-items: center; background: var(--ink); border-radius: 50%; color: #f6d56d; display: inline-flex; font-size: 13px; height: 28px; justify-content: center; width: 28px; }
  .brand-logo-img { height: 36px; width: 36px; object-fit: contain; filter: drop-shadow(0 4px 10px rgba(183, 142, 255, 0.45)); transition: transform .3s ease; }
  .brand:hover .brand-logo-img { transform: scale(1.1) rotate(4deg); }
  .main-nav { align-items: center; display: flex; gap: 28px; font-size: 14px; font-weight: 600; }
  .main-nav > a:not(.register-link) { color: #35524b; transition: color .2s ease; }
  .main-nav > a:not(.register-link):hover { color: var(--coral); }
  .nav-divider { background: var(--line); height: 22px; width: 1px; }
  .login-link { padding: 9px 1px; }
  .register-link, .primary-button { align-items: center; background: var(--ink); border: 1px solid var(--ink); border-radius: 999px; color: #fff !important; display: inline-flex; gap: 10px; justify-content: center; padding: 11px 18px; transition: transform .2s ease, background .2s ease; }
  .register-link:hover, .primary-button:hover { background: var(--pine); border-color: var(--pine); transform: translateY(-2px); }
  .arrow { display: inline-block; font-size: 17px; line-height: 10px; transition: transform .2s ease; }
  a:hover .arrow { transform: translateX(3px); }
  .menu-toggle { background: none; border: 0; cursor: pointer; display: none; height: 36px; padding: 8px; width: 42px; }
  .menu-toggle span { background: var(--ink); display: block; height: 2px; margin: 5px auto; width: 23px; }

  .hero { display: grid; gap: clamp(36px, 5vw, 80px); grid-template-columns: minmax(0, 1fr) minmax(280px, 420px); margin: 0 auto; max-width: 1440px; min-height: 650px; padding: 150px clamp(24px, 8vw, 132px) 76px; position: relative; }
  .hero::before { background: radial-gradient(circle, rgba(213, 239, 220, .8) 0, rgba(213, 239, 220, 0) 68%); content: ''; height: 730px; left: -180px; position: absolute; top: 0; width: 730px; z-index: 0; }
  .hero-copy, .showcase { position: relative; z-index: 1; }
  .hero-copy { align-self: center; max-width: 630px; }
  .eyebrow { align-items: center; color: #477066; display: flex; font-family: 'DM Mono', monospace; font-size: 11px; font-weight: 500; gap: 8px; letter-spacing: 1.25px; margin: 0 0 22px; }
  .pulse-dot { background: var(--coral); border-radius: 50%; box-shadow: 0 0 0 5px rgba(242, 118, 92, .13); height: 7px; width: 7px; }
  h1, h2, h3, p { margin-top: 0; }
  h1, h2 { font-family: 'Fraunces', Georgia, serif; font-weight: 500; letter-spacing: -1.9px; }
  h1 { font-size: clamp(47px, 5.1vw, 76px); line-height: 1.04; margin-bottom: 23px; }
  .hero-description { color: #506660; font-size: 18px; line-height: 1.65; margin-bottom: 31px; max-width: 570px; }
  .hero-actions { align-items: center; display: flex; flex-wrap: wrap; gap: 23px; }
  .primary-button { font-size: 15px; font-weight: 700; padding: 15px 23px; }
  .text-button { border-bottom: 1px solid var(--ink); font-size: 14px; font-weight: 700; padding-bottom: 3px; }
  .text-button span { font-size: 17px; margin-left: 6px; }
  .input-pills { display: flex; flex-wrap: wrap; gap: 9px; margin-top: 52px; }
  .input-pills span { border: 1px solid rgba(36, 101, 79, .21); border-radius: 999px; color: #40645b; font-size: 12px; font-weight: 600; padding: 8px 13px; }

  .showcase { align-self: center; justify-self: center; max-width: 410px; min-width: 0; width: 100%; }
  .showcase-glow { background: #ebc76b; border-radius: 50%; filter: blur(1px); height: 79%; opacity: .55; position: absolute; right: -14%; top: 12%; width: 79%; }
  .gallery-card { background: #fbfaf4; box-shadow: 18px 22px 0 rgba(24, 56, 50, .12), 0 24px 54px rgba(18, 48, 42, .15); overflow: hidden; position: relative; transform: rotate(2.1deg); }
  .gallery-topbar { align-items: center; color: #5d706b; display: flex; font-family: 'DM Mono', monospace; font-size: 10px; justify-content: space-between; letter-spacing: .7px; padding: 16px 19px; }
  .gallery-live { align-items: center; display: flex; gap: 7px; }
  .gallery-live i { background: #55a97a; border-radius: 50%; height: 7px; width: 7px; }
  .image-wrap { aspect-ratio: 1.17 / 1; overflow: hidden; position: relative; }
  .pet-image { height: 100%; left: 0; object-fit: cover; opacity: 0; position: absolute; top: 0; transform: scale(1.06); transition: opacity .8s ease, transform 4.6s ease; width: 100%; }
  .pet-image.image-active { opacity: 1; transform: scale(1); }
  .image-shade { background: linear-gradient(0deg, rgba(5, 30, 24, .75) 0%, rgba(5, 30, 24, 0) 48%); inset: 0; position: absolute; }
  .pet-caption { bottom: 22px; color: #fff; left: 24px; position: absolute; }
  .pet-caption p { font-family: 'DM Mono', monospace; font-size: 10px; letter-spacing: .7px; margin-bottom: 7px; text-transform: uppercase; }
  .pet-caption h2 { font-size: 34px; letter-spacing: -1px; line-height: 1; margin: 0; }
  .gallery-bottom { min-height: 103px; padding: 15px 19px 14px; }
  .gallery-bottom > p { color: #476158; font-size: 12px; line-height: 1.45; margin-bottom: 12px; min-height: 35px; }
  .gallery-controls { align-items: center; display: flex; justify-content: space-between; }
  .gallery-controls > button { background: transparent; border: 1px solid #cbd8cf; border-radius: 50%; color: var(--ink); cursor: pointer; font-size: 15px; height: 28px; line-height: 1; padding: 0; transition: background .2s ease; width: 28px; }
  .gallery-controls > button:hover { background: var(--mint); }
  .slide-dots { display: flex; gap: 6px; }
  .dot { background: #c5d2cb; border: 0; border-radius: 50%; cursor: pointer; height: 6px; padding: 0; transition: width .25s ease, background .25s ease; width: 6px; }
  .dot.dot-active { background: var(--pine); border-radius: 8px; width: 20px; }

  .signal-strip { align-items: center; background: var(--mint); display: flex; gap: 28px; justify-content: space-between; padding: 21px clamp(24px, 8vw, 132px); }
  .signal-strip > p { font-size: 14px; font-weight: 600; letter-spacing: -.25px; margin: 0; }
  .triage-labels { display: flex; gap: clamp(17px, 3vw, 40px); }
  .triage-labels span { align-items: center; color: #36544b; display: flex; font-family: 'DM Mono', monospace; font-size: 10px; gap: 7px; letter-spacing: .7px; text-transform: uppercase; }
  .triage-labels i { border-radius: 50%; height: 7px; width: 7px; }
  .monitor-dot { background: #46a56f; } .consult-dot { background: #e7a331; } .urgent-dot { background: var(--coral); }

  .section { margin: 0 auto; max-width: 1440px; padding-left: clamp(24px, 8vw, 132px); padding-right: clamp(24px, 8vw, 132px); scroll-margin-top: 75px; }
  .about-section { display: grid; gap: clamp(42px, 8vw, 126px); grid-template-columns: .83fr 1.17fr; padding-bottom: 125px; padding-top: 132px; }
  .section-intro h2, .why-heading h2 { font-size: clamp(38px, 4.05vw, 58px); line-height: 1.08; margin-bottom: 22px; }
  .section-intro > p:last-child, .why-heading > p { color: var(--muted); font-size: 16px; line-height: 1.7; max-width: 465px; }
  .about-grid { display: grid; gap: 15px; grid-template-columns: repeat(2, minmax(0, 1fr)); list-style: none; margin: 0; padding: 0; }
  .about-card { background: #f0f6ee; border-radius: 3px; display: flex; flex-direction: column; justify-content: space-between; min-height: 217px; padding: 25px; transition: transform .2s ease, box-shadow .2s ease; }
  .about-card:nth-child(2), .about-card:nth-child(3) { background: #f9f0dd; }
  .about-card:nth-child(3) { background: #f5e7df; }
  .about-card:hover { box-shadow: 0 12px 23px rgba(18, 48, 42, .1); transform: translateY(-4px); }
  .card-icon { align-items: center; background: rgba(255,255,255,.7); border-radius: 50%; color: var(--pine); display: flex; font-family: Georgia, serif; font-size: 23px; height: 42px; justify-content: center; margin-bottom: 23px; width: 42px; }
  .about-card h3, .reason h3 { font-size: 16px; letter-spacing: -.25px; margin-bottom: 7px; }
  .about-card p { color: #587068; font-size: 13px; line-height: 1.52; margin: 0; }

  .why-section { background: var(--deep-ink); color: #f9f7ef; display: grid; gap: clamp(45px, 8vw, 142px); grid-template-columns: .75fr 1.25fr; max-width: none; padding-bottom: 115px; padding-top: 115px; }
  .eyebrow-light { color: #abd0b8; }
  .why-heading h2 { color: #fffdf8; }
  .why-heading > p { color: #b8cbc2; margin-bottom: 31px; }
  .outline-button { align-items: center; border: 1px solid rgba(255,255,255,.55); border-radius: 999px; display: inline-flex; font-size: 14px; font-weight: 700; gap: 11px; padding: 13px 19px; transition: background .2s ease, color .2s ease; }
  .outline-button:hover { background: #fffdf8; color: var(--ink); }
  .reasons-list { list-style: none; margin: 0; padding: 0; }
  .reason { border-top: 1px solid rgba(235, 249, 240, .2); display: grid; gap: 24px; grid-template-columns: 44px 1fr; padding: 22px 0 24px; }
  .reason:last-child { border-bottom: 1px solid rgba(235, 249, 240, .2); }
  .reason-number { color: #9bc6a7; font-family: 'DM Mono', monospace; font-size: 11px; padding-top: 3px; }
  .reason h3 { color: #fffdf8; font-size: 18px; margin-bottom: 8px; }
  .reason p { color: #b8cbc2; font-size: 14px; line-height: 1.6; margin: 0; max-width: 530px; }

  .care-note { align-items: flex-start; background: #f8f2e7; display: flex; gap: 16px; justify-content: center; padding: 25px clamp(24px, 7vw, 120px); }
  .care-note-icon { align-items: center; background: var(--coral); border-radius: 50%; color: #fff; display: flex; flex: 0 0 auto; font-size: 16px; height: 23px; justify-content: center; margin-top: 1px; width: 23px; }
  .care-note p { color: #5a625e; font-size: 13px; line-height: 1.6; margin: 0; max-width: 800px; }
  .care-note strong { color: var(--ink); }
  .site-footer { align-items: center; background: #fbfaf5; display: flex; justify-content: space-between; padding: 26px clamp(24px, 5.5vw, 92px); }
  .footer-brand { font-size: 17px; }
  .site-footer p, .site-footer > span { color: #74817c; font-size: 12px; margin: 0; }

  @media (max-width: 900px) {
    .hero { gap: 56px; grid-template-columns: 1fr; padding-top: 139px; }
    .hero-copy { max-width: 710px; }
    .showcase { margin: 0 auto; max-width: 560px; width: min(82vw, 560px); }
    .about-section, .why-section { grid-template-columns: 1fr; }
    .about-section { gap: 45px; }
    .why-section { gap: 50px; }
  }

  @media (max-width: 650px) {
    .site-header { height: 68px; padding: 0 22px; }
    .main-nav { align-items: stretch; background: var(--paper); border-bottom: 1px solid var(--line); box-shadow: 0 13px 19px rgba(15, 43, 38, .08); display: none; flex-direction: column; gap: 0; left: 0; padding: 12px 22px 20px; position: absolute; right: 0; top: 67px; }
    .main-nav.nav-open { display: flex; }
    .main-nav > a:not(.register-link) { padding: 13px 0; }
    .main-nav .nav-divider { display: none; }
    .register-link { margin-top: 9px; }
    .menu-toggle { display: block; }
    .hero { min-height: unset; padding: 123px 24px 69px; }
    h1 { font-size: clamp(43px, 12vw, 57px); letter-spacing: -1.5px; }
    .hero-description { font-size: 16px; }
    .input-pills { margin-top: 37px; }
    .showcase { width: min(100%, 475px); }
    .gallery-card { box-shadow: 12px 15px 0 rgba(24, 56, 50, .11), 0 18px 36px rgba(18, 48, 42, .12); }
    .signal-strip { align-items: flex-start; flex-direction: column; gap: 14px; padding: 19px 24px; }
    .triage-labels { gap: 16px; }
    .triage-labels span { font-size: 9px; }
    .about-section { padding-bottom: 78px; padding-top: 84px; }
    .about-grid { grid-template-columns: 1fr; }
    .about-card { min-height: 180px; }
    .why-section { padding-bottom: 75px; padding-top: 78px; }
    .site-footer { align-items: flex-start; flex-direction: column; gap: 14px; }
  }

  /* Chrome black + digital lilac visual system */
  :root {
    --ink: #f5f1ff;
    --deep-ink: #09090d;
    --pine: #b79aff;
    --mint: #201d2a;
    --cream: #111116;
    --paper: #0a0a0e;
    --coral: #c6aeff;
    --muted: #aaa5b5;
    --line: rgba(221, 211, 255, .15);
  }

  .pet-care-page { background: var(--paper); color: var(--ink); }
  .site-header { background: rgba(10, 10, 14, .82); border-bottom-color: rgba(221, 211, 255, .11); }
  .brand { color: #faf8ff; }
  .brand-mark { background: linear-gradient(135deg, #e4d9ff, #9073e5); color: #121016; box-shadow: 0 0 24px rgba(183, 154, 255, .28); }
  .main-nav > a:not(.register-link) { color: #c6c0d2; }
  .main-nav > a:not(.register-link):hover { color: #e2d8ff; }
  .nav-divider { background: rgba(221, 211, 255, .2); }
  .register-link, .primary-button { background: #d7c7ff; border-color: #d7c7ff; color: #17131f !important; }
  .register-link:hover, .primary-button:hover { background: #a988ff; border-color: #a988ff; color: #0b0811 !important; }
  .menu-toggle span { background: #e4dcf5; }

  .hero { background-image: linear-gradient(rgba(190, 168, 255, .055) 1px, transparent 1px), linear-gradient(90deg, rgba(190, 168, 255, .055) 1px, transparent 1px); background-size: 54px 54px; }
  .hero::before { background: radial-gradient(circle, rgba(142, 105, 231, .22) 0, rgba(10, 10, 14, 0) 68%); }
  .eyebrow { color: #bda9ee; }
  .pulse-dot { background: #b799ff; box-shadow: 0 0 0 5px rgba(183, 153, 255, .13); }
  h1, h2 { color: #f7f3ff; }
  .hero-description { color: #b7b0c3; }
  .text-button { border-bottom-color: #d9ccff; color: #e6deff; }
  .text-button:hover { color: #c4aaff; }
  .hero-scroll-link { display: inline-block; margin-top: 3px; }
  .input-pills span { background: rgba(183, 154, 255, .075); border-color: rgba(204, 182, 255, .26); color: #d1c4ed; }

  .showcase-glow { background: #9a77ed; filter: blur(20px); opacity: .26; }
  .gallery-card { background: #131219; box-shadow: 18px 22px 0 rgba(183, 154, 255, .12), 0 24px 54px rgba(0, 0, 0, .42); }
  .gallery-topbar { color: #b5adbf; }
  .gallery-live i { background: #b496ff; box-shadow: 0 0 11px #b496ff; }
  .image-shade { background: linear-gradient(0deg, rgba(7, 5, 11, .87) 0%, rgba(7, 5, 11, 0) 55%); }
  .gallery-bottom > p { color: #bcb5c8; }
  .gallery-controls > button { border-color: #4a4656; color: #e8e0fb; }
  .gallery-controls > button:hover { background: #282235; }
  .dot { background: #5e5868; }
  .dot.dot-active { background: #c2a8ff; }

  .signal-strip { background: #15131d; border-bottom: 1px solid rgba(221, 211, 255, .1); border-top: 1px solid rgba(221, 211, 255, .1); }
  .signal-strip > p { color: #ddd7e8; }
  .triage-labels span { color: #bdb6c9; }
  .monitor-dot { background: #bd9cff; box-shadow: 0 0 8px rgba(189, 156, 255, .72); }
  .consult-dot { background: #8f7abd; }
  .urgent-dot { background: #e1cbff; }

  .about-section { background: #0d0d12; }
  .section-intro > p:last-child { color: #aaa4b5; }
  .about-card { background: #15141b; border: 1px solid rgba(217, 202, 255, .12); box-shadow: inset 0 1px 0 rgba(255,255,255,.025); }
  .about-card:nth-child(2), .about-card:nth-child(3) { background: #181620; }
  .about-card:nth-child(3) { background: #15141b; }
  .about-card:hover { border-color: rgba(202, 179, 255, .46); box-shadow: 0 15px 30px rgba(0, 0, 0, .32), 0 0 0 1px rgba(202, 179, 255, .08); }
  .card-icon { background: #25212f; color: #cfbbff; }
  .about-card h3 { color: #eee9f9; }
  .about-card p { color: #aaa4b6; }

  .why-section { background: #121017; border-bottom: 1px solid rgba(221, 211, 255, .12); border-top: 1px solid rgba(221, 211, 255, .12); }
  .eyebrow-light { color: #beabef; }
  .why-heading > p, .reason p { color: #afa8ba; }
  .outline-button { border-color: rgba(226, 215, 255, .5); color: #f0eaff; }
  .outline-button:hover { background: #e3d7ff; color: #15121c; }
  .reason { border-top-color: rgba(221, 211, 255, .16); }
  .reason:last-child { border-bottom-color: rgba(221, 211, 255, .16); }
  .reason-number { color: #c3abff; }
  .reason h3 { color: #f7f3ff; }

  .care-note { background: #1b1823; border-bottom: 1px solid rgba(221, 211, 255, .1); }
  .care-note-icon { background: #b79aff; color: #15111d; }
  .care-note p { color: #bbb4c6; }
  .care-note strong { color: #f2edff; }
  .site-footer { background: #09090d; }
  .site-footer p, .site-footer > span { color: #8f899b; }

  @media (prefers-reduced-motion: no-preference) {
    .reveal-section .section-intro,
    .reveal-section .why-heading,
    .reveal-section .about-card,
    .reveal-section .reason { opacity: 0; transform: translateY(30px); }
    .section-visible .section-intro,
    .section-visible .why-heading,
    .section-visible .about-card,
    .section-visible .reason { animation: section-rise .72s cubic-bezier(.2, .75, .22, 1) forwards; }
    .section-visible .about-card:nth-child(2), .section-visible .reason:nth-child(2) { animation-delay: .09s; }
    .section-visible .about-card:nth-child(3), .section-visible .reason:nth-child(3) { animation-delay: .18s; }
    .section-visible .about-card:nth-child(4), .section-visible .reason:nth-child(4) { animation-delay: .27s; }
  }

  @keyframes section-rise { to { opacity: 1; transform: translateY(0); } }

  @media (max-width: 650px) {
    .main-nav { background: #101016; border-bottom-color: rgba(221, 211, 255, .13); box-shadow: 0 13px 26px rgba(0, 0, 0, .43); }
    .gallery-card { box-shadow: 12px 15px 0 rgba(183, 154, 255, .11), 0 18px 36px rgba(0, 0, 0, .4); }
  }

  /* Lilac-forward balance: ~60% digital lilac surfaces, ~40% chrome black contrast. */
  :root {
    --ink: #211a2c;
    --deep-ink: #111016;
    --pine: #7950d8;
    --mint: #d3baff;
    --cream: #f3edff;
    --paper: #e5d8ff;
    --coral: #9b73ed;
    --muted: #625b70;
    --line: rgba(35, 27, 48, .16);
  }

  .pet-care-page { background: #e5d8ff; color: #211a2c; }
  .site-header { background: rgba(237, 228, 255, .86); border-bottom-color: rgba(37, 27, 54, .13); }
  .brand { color: #20182a; }
  .brand-mark { background: linear-gradient(135deg, #19151f, #3b3048); color: #d9c5ff; box-shadow: none; }
  .main-nav > a:not(.register-link) { color: #40364d; }
  .main-nav > a:not(.register-link):hover { color: #7550c7; }
  .nav-divider { background: rgba(43, 33, 57, .2); }
  .register-link, .primary-button { background: #19161f; border-color: #19161f; color: #f0e9ff !important; }
  .register-link:hover, .primary-button:hover { background: #5e3baa; border-color: #5e3baa; color: #fff !important; }
  .menu-toggle span { background: #211a2c; }

  .hero { background-color: #ded0fb; background-image: linear-gradient(rgba(37, 27, 54, .09) 1px, transparent 1px), linear-gradient(90deg, rgba(37, 27, 54, .09) 1px, transparent 1px); }
  .hero::before { background: radial-gradient(circle, rgba(255, 255, 255, .64) 0, rgba(229, 216, 255, 0) 68%); }
  .eyebrow { color: #6344a8; }
  .pulse-dot { background: #6c45c5; box-shadow: 0 0 0 5px rgba(107, 69, 197, .13); }
  h1, h2 { color: #211a2c; }
  .hero-description { color: #554d61; }
  .text-button { border-bottom-color: #2b203a; color: #2d2538; }
  .text-button:hover { color: #7651c8; }
  .input-pills span { background: rgba(255, 255, 255, .34); border-color: rgba(69, 49, 103, .23); color: #483b58; }

  .showcase-glow { background: #8760d6; opacity: .32; }
  .gallery-card { background: #17131d; box-shadow: 18px 22px 0 rgba(38, 28, 54, .18), 0 24px 54px rgba(46, 33, 66, .2); }
  .gallery-topbar { color: #c9bfda; }
  .gallery-live i { background: #c9aaff; box-shadow: 0 0 11px #c9aaff; }
  .gallery-bottom > p { color: #c7bfd1; }
  .gallery-controls > button { border-color: #655d70; }
  .gallery-controls > button:hover { background: #332a40; }
  .dot { background: #6f667d; }
  .dot.dot-active { background: #d3baff; }

  .signal-strip { background: #15121b; border-color: #15121b; }
  .signal-strip > p { color: #eee9f8; }
  .triage-labels span { color: #d3cbe0; }
  .monitor-dot { background: #d5bdff; box-shadow: 0 0 8px rgba(213, 189, 255, .72); }
  .consult-dot { background: #9b7cd5; }
  .urgent-dot { background: #f0e7ff; }

  .about-section { background: #efe8ff; }
  .section-intro > p:last-child { color: #625a70; }
  .about-card, .about-card:nth-child(2), .about-card:nth-child(3) { background: #ddccff; border-color: rgba(48, 35, 68, .12); box-shadow: inset 0 1px 0 rgba(255,255,255,.5); }
  .about-card:nth-child(2) { background: #d3b9ff; }
  .about-card:nth-child(3) { background: #e7dcff; }
  .about-card:nth-child(4) { background: #cab0f6; }
  .about-card:hover { border-color: rgba(74, 49, 124, .46); box-shadow: 0 15px 30px rgba(50, 33, 72, .15), 0 0 0 1px rgba(255,255,255,.22); }
  .card-icon { background: rgba(255,255,255,.58); color: #58369f; }
  .about-card h3 { color: #251d31; }
  .about-card p { color: #574d65; }

  .why-section { background: #c5a5fa; border-bottom-color: rgba(43, 31, 59, .17); border-top-color: rgba(43, 31, 59, .17); }
  .eyebrow-light { color: #57399b; }
  .why-heading h2, .reason h3 { color: #211a2c; }
  .why-heading > p, .reason p { color: #4e415e; }
  .outline-button { border-color: rgba(33, 26, 44, .5); color: #251c31; }
  .outline-button:hover { background: #19151f; color: #f3edff; }
  .reason { border-top-color: rgba(43, 31, 59, .2); }
  .reason:last-child { border-bottom-color: rgba(43, 31, 59, .2); }
  .reason-number { color: #57399b; }

  .care-note { background: #f3efff; border-bottom-color: rgba(43, 31, 59, .12); }
  .care-note-icon { background: #6d47bf; color: #fff; }
  .care-note p { color: #5b5367; }
  .care-note strong { color: #282033; }
  .site-footer { background: #15121b; }
  .footer-brand { color: #f2ecff; }
  .site-footer p, .site-footer > span { color: #b9afc7; }

  @media (prefers-reduced-motion: no-preference) {
    .reveal-section .section-intro,
    .reveal-section .why-heading,
    .reveal-section .about-card,
    .reveal-section .reason { transform: translateY(38px) scale(.975); }
    .section-visible .section-intro,
    .section-visible .why-heading,
    .section-visible .about-card,
    .section-visible .reason { animation-name: lilac-pop; }
  }

  @keyframes lilac-pop {
    0% { filter: blur(4px); opacity: 0; transform: translateY(38px) scale(.975); }
    72% { filter: blur(0); opacity: 1; transform: translateY(-3px) scale(1.012); }
    100% { filter: blur(0); opacity: 1; transform: translateY(0) scale(1); }
  }

  @media (max-width: 650px) {
    .main-nav { background: #e9deff; border-bottom-color: rgba(43, 31, 59, .14); box-shadow: 0 13px 26px rgba(45, 30, 65, .15); }
    .gallery-card { box-shadow: 12px 15px 0 rgba(38, 28, 54, .16), 0 18px 36px rgba(46, 33, 66, .18); }
  }

  /* 50 / 50 composition: lilac carries the content, chrome black creates equal visual counterweight. */
  .hero {
    background-color: #14121a;
    background-image: linear-gradient(118deg, #e3d5ff 0%, #e3d5ff 52%, #14121a 52%, #14121a 100%);
    background-repeat: no-repeat;
    background-size: 100% 100%;
  }
  .hero::before { background: radial-gradient(circle, rgba(255, 255, 255, .68) 0, rgba(229, 216, 255, 0) 68%); }
  .why-section { background: #15121b; border-bottom-color: rgba(224, 211, 255, .16); border-top-color: rgba(224, 211, 255, .16); }
  .eyebrow-light { color: #cbb5ff; }
  .why-heading h2, .reason h3 { color: #f6f1ff; }
  .why-heading > p, .reason p { color: #c1b8cd; }
  .outline-button { border-color: rgba(230, 220, 255, .52); color: #f1eaff; }
  .outline-button:hover { background: #d7c4ff; color: #1a1521; }
  .reason { border-top-color: rgba(229, 216, 255, .18); }
  .reason:last-child { border-bottom-color: rgba(229, 216, 255, .18); }
  .reason-number { color: #c9adff; }

  @media (max-width: 900px) {
    .hero { background-image: linear-gradient(150deg, #e3d5ff 0%, #e3d5ff 58%, #14121a 58%, #14121a 100%); }
  }

  @media (max-width: 650px) {
    .hero { background-image: linear-gradient(166deg, #e3d5ff 0%, #e3d5ff 63%, #14121a 63%, #14121a 100%); }
  }

  /* Separate the dark gallery card clearly from the chrome-black hero area. */
  .gallery-card {
    border: 2px solid #ddccff;
    border-radius: 9px;
    box-shadow: 0 0 0 9px rgba(210, 183, 255, .45), 0 0 38px rgba(191, 154, 255, .48), 18px 22px 0 rgba(25, 18, 34, .28);
  }
  .image-wrap { border-bottom: 1px solid rgba(227, 211, 255, .64); border-top: 1px solid rgba(227, 211, 255, .64); }

  @media (max-width: 650px) {
    .gallery-card { box-shadow: 0 0 0 6px rgba(210, 183, 255, .45), 0 0 28px rgba(191, 154, 255, .42), 12px 15px 0 rgba(25, 18, 34, .28); }
  }

  .modal-backdrop { align-items: center; background: rgba(12, 9, 17, .68); backdrop-filter: blur(8px); display: flex; inset: 0; justify-content: center; padding: 22px; position: fixed; z-index: 50; }
  .login-modal { animation: modal-enter .36s cubic-bezier(.2, .78, .25, 1) both; background: linear-gradient(145deg, #f1e9ff, #dac5ff); border: 1px solid rgba(255,255,255,.82); border-radius: 18px; box-shadow: 0 25px 80px rgba(0, 0, 0, .46), 0 0 0 8px rgba(202, 174, 255, .16); color: #241c30; max-width: 440px; padding: 42px 42px 31px; position: relative; width: 100%; }
  .modal-close { align-items: center; background: rgba(47, 35, 65, .08); border: 0; border-radius: 50%; color: #32263e; cursor: pointer; display: flex; font-size: 27px; font-weight: 300; height: 34px; justify-content: center; line-height: 1; padding: 0 0 4px; position: absolute; right: 18px; top: 18px; transition: background .2s ease, transform .2s ease; width: 34px; }
  .modal-close:hover { background: rgba(47, 35, 65, .16); transform: rotate(90deg); }
  .modal-paw { align-items: center; background: #1e1829; border-radius: 50%; color: #d8c0ff; display: inline-flex; height: 36px; justify-content: center; width: 36px; }
  .modal-kicker { color: #6846aa; font-family: 'DM Mono', monospace; font-size: 10px; font-weight: 500; letter-spacing: 1.2px; margin: 18px 0 10px; }
  .login-modal h2 { color: #211927; font-size: 42px; letter-spacing: -1.3px; line-height: 1; margin-bottom: 11px; }
  .modal-description { color: #5d536b; font-size: 14px; line-height: 1.55; margin-bottom: 28px; }
  .login-form { display: grid; gap: 10px; }
  .login-form label { color: #372b45; font-size: 12px; font-weight: 700; }
  .login-form input { background: rgba(255,255,255,.72); border: 1px solid rgba(69, 48, 98, .2); border-radius: 9px; color: #281d35; font: inherit; font-size: 14px; height: 47px; margin-bottom: 9px; outline: none; padding: 0 14px; transition: border-color .2s ease, box-shadow .2s ease; width: 100%; }
  .login-form input::placeholder { color: #91869e; }
  .login-form input:focus { border-color: #7950d8; box-shadow: 0 0 0 3px rgba(121, 80, 216, .16); }
  .password-label-row { align-items: center; display: flex; justify-content: space-between; margin-top: 1px; }
  .password-label-row a { color: #6842b5; font-size: 11px; font-weight: 700; }
  .password-label-row a:hover, .new-user a:hover { text-decoration: underline; }
  .login-submit { align-items: center; background: #1b1622; border: 1px solid #1b1622; border-radius: 9px; color: #f8f3ff; cursor: pointer; display: flex; font-size: 14px; font-weight: 700; gap: 10px; justify-content: center; margin-top: 8px; min-height: 48px; transition: background .2s ease, transform .2s ease; }
  .login-submit:hover { background: #58379d; border-color: #58379d; transform: translateY(-2px); }
  .new-user { border-top: 1px solid rgba(63, 44, 86, .16); color: #5d536b; font-size: 13px; margin: 25px 0 0; padding-top: 22px; text-align: center; }
  .new-user a { color: #4e2d91; font-weight: 700; }
  @keyframes modal-enter { from { opacity: 0; transform: translateY(18px) scale(.97); } to { opacity: 1; transform: translateY(0) scale(1); } }

  @media (max-width: 480px) {
    .login-modal { border-radius: 15px; padding: 35px 24px 26px; }
    .login-modal h2 { font-size: 37px; }
  }

  /* Password toggle and compact register modal styles */
  .password-input-wrapper { position: relative; width: 100%; margin-bottom: 9px; }
  .password-input-wrapper input { margin-bottom: 0 !important; padding-right: 42px !important; }
  .password-toggle-btn { position: absolute; right: 10px; top: 50%; transform: translateY(-50%); background: transparent; border: none; color: #a59ab8; cursor: pointer; display: flex; align-items: center; justify-content: center; padding: 4px; border-radius: 6px; transition: color .2s ease, background .2s ease; }
  .password-toggle-btn:hover { color: #f4efff; background: rgba(231, 219, 255, .14); }

  /* Chrome-black account panels with lilac details. */
  .login-modal { background: linear-gradient(145deg, #121016 0%, #1c1725 68%, #2b203a 100%); border-color: rgba(224, 207, 255, .7); box-shadow: 0 25px 80px rgba(0, 0, 0, .6), 0 0 0 8px rgba(201, 170, 255, .22), inset 0 1px 0 rgba(255,255,255,.1); color: #f2ebff; }
  .register-modal { max-width: 390px; padding: 30px 32px 24px; }
  .register-modal .modal-kicker { margin: 12px 0 6px; }
  .register-modal h2 { font-size: 30px; margin-bottom: 6px; letter-spacing: -1px; }
  .register-modal .modal-description { font-size: 13px; margin-bottom: 16px; line-height: 1.45; }
  .register-modal .login-form { gap: 4px; }
  .register-modal .login-form label { font-size: 11.5px; margin-bottom: 2px; }
  .register-modal .login-form input { height: 42px; font-size: 13.5px; margin-bottom: 6px; }
  .register-modal .password-input-wrapper { margin-bottom: 6px; }
  .register-modal .login-submit { min-height: 44px; margin-top: 6px; font-size: 13.5px; }
  .register-modal .new-user { margin-top: 16px; padding-top: 14px; font-size: 12.5px; }

  .modal-close { background: rgba(231, 219, 255, .12); color: #f0e8ff; }
  .modal-close:hover { background: rgba(231, 219, 255, .23); }
  .modal-paw { background: linear-gradient(135deg, #d9c1ff, #8c61da); color: #19131f; }
  .modal-kicker { color: #d2baff; }
  .login-modal h2 { color: #faf7ff; }
  .modal-description { color: #c1b8ce; }
  .login-form label { color: #efe9fb; }
  .login-form input { background: rgba(5, 5, 8, .48); border-color: rgba(219, 199, 255, .27); color: #f4efff; }
  .login-form input::placeholder { color: #958ba5; }
  .login-form input:focus { border-color: #c7abff; box-shadow: 0 0 0 3px rgba(183, 142, 255, .2); }
  .password-label-row a { color: #cbb4ff; }
  .login-submit { background: #d8c1ff; border-color: #d8c1ff; color: #1d1626; }
  .login-submit:hover { background: #b893ff; border-color: #b893ff; color: #160f1e; }
  .new-user { border-top-color: rgba(223, 207, 255, .18); color: #bdb4ca; }
  .new-user a { color: #d4bcff; }
  .form-error { background: rgba(231, 169, 190, .12); border: 1px solid rgba(255, 191, 210, .34); border-radius: 7px; color: #ffd7e5; font-size: 12px; font-weight: 600; margin: 0 0 2px; padding: 9px 11px; }
  .form-notice { background: rgba(171, 231, 188, .16); border: 1px solid rgba(171, 231, 188, .42); border-radius: 7px; color: #ddffe4; font-size: 12px; font-weight: 600; line-height: 1.4; margin: 0 0 2px; padding: 9px 11px; }
  .login-submit:disabled { cursor: wait; opacity: .7; transform: none; }

  .welcome-backdrop { align-items: center; background: rgba(8, 6, 12, .79); backdrop-filter: blur(14px); display: flex; inset: 0; justify-content: center; padding: 24px; position: fixed; z-index: 60; }
  .welcome-hub { animation: welcome-arrive .65s cubic-bezier(.16,.8,.24,1) both; background: #121016; border: 1px solid rgba(222, 202, 255, .42); border-radius: 26px; box-shadow: 0 32px 95px rgba(0,0,0,.62), 0 0 0 9px rgba(192, 151, 255, .12); display: grid; grid-template-columns: minmax(0, 1fr) minmax(300px, .84fr); max-width: 930px; min-height: 570px; overflow: hidden; position: relative; width: 100%; }
  .welcome-grid-glow { background-image: linear-gradient(rgba(217, 191, 255, .07) 1px, transparent 1px), linear-gradient(90deg, rgba(217, 191, 255, .07) 1px, transparent 1px); background-size: 42px 42px; inset: 0; mask-image: linear-gradient(115deg, #000 0%, transparent 62%); pointer-events: none; position: absolute; }
  .welcome-content { padding: clamp(38px, 6vw, 66px); position: relative; z-index: 1; }.welcome-mark { align-items: center; background: #d8c0ff; border-radius: 50%; color: #1d1625; display: flex; height: 43px; justify-content: center; width: 43px; }.welcome-kicker { color: #cdb2ff; font-family: 'DM Mono', monospace; font-size: 10px; letter-spacing: 1.2px; margin: 27px 0 14px; }.welcome-content h2 { color: #f8f3ff; font-family: Fraunces, Georgia, serif; font-size: clamp(48px, 5vw, 66px); font-weight: 500; letter-spacing: -2.6px; line-height: .94; margin: 0; }.welcome-content h2 em { color: #c29bff; font-style: italic; }.welcome-copy { color: #bdb2ca; font-size: 14px; line-height: 1.65; margin: 22px 0 29px; max-width: 360px; }
  .health-check-launch { align-items: center; background: #e2d2ff; border: 0; border-radius: 13px; color: #21182a; cursor: pointer; display: grid; gap: 13px; grid-template-columns: 27px 1fr 32px; padding: 16px; text-align: left; transition: box-shadow .25s ease, transform .25s ease; width: 100%; }.health-check-launch:hover { box-shadow: 0 12px 0 #8a60c7, 0 18px 29px rgba(94, 61, 145, .28); transform: translateY(-5px); }.health-check-index { align-self: start; color: #7049ae; font-family: 'DM Mono', monospace; font-size: 10px; padding-top: 3px; }.health-check-text { display: grid; }.health-check-text small { color: #6f528d; font-family: 'DM Mono', monospace; font-size: 8px; letter-spacing: .8px; margin-bottom: 4px; }.health-check-text strong { font-size: 16px; letter-spacing: -.2px; }.health-check-text em { color: #66576f; font-size: 10px; font-style: normal; line-height: 1.4; margin-top: 4px; }.health-check-arrow { align-items: center; background: #201727; border-radius: 50%; color: #e9ddff; display: flex; font-size: 17px; height: 31px; justify-content: center; transition: transform .25s ease; width: 31px; }.health-check-launch:hover .health-check-arrow { transform: rotate(45deg); }
  .welcome-pet-stack { background: #c5a3fb; overflow: hidden; position: relative; }.welcome-pet-stack::before { background: radial-gradient(circle, rgba(255,255,255,.75), transparent 67%); content: ''; height: 380px; left: -100px; position: absolute; top: -80px; width: 380px; }.welcome-pet-stack figure { box-shadow: 0 18px 30px rgba(44, 28, 62, .26); margin: 0; overflow: hidden; position: absolute; z-index: 1; }.welcome-pet-stack figure::after { background: linear-gradient(0deg, rgba(15,9,19,.74), transparent 55%); content: ''; inset: 0; position: absolute; }.welcome-pet-stack img { height: 100%; object-fit: cover; transition: transform 1.5s ease; width: 100%; }.welcome-pet-stack figure:hover img { transform: scale(1.1); }.welcome-pet-stack figcaption { bottom: 12px; color: #fdfaff; font-family: 'DM Mono', monospace; font-size: 9px; left: 13px; letter-spacing: .75px; position: absolute; z-index: 1; }.welcome-cat { border: 3px solid #1d1526; height: 250px; left: 47px; top: 55px; transform: rotate(-5deg); width: 208px; }.welcome-dog { border: 3px solid #e3d0ff; bottom: 48px; height: 242px; right: 34px; transform: rotate(5deg); width: 204px; }.welcome-orbit { border: 1px solid rgba(55, 33, 82, .32); border-radius: 50%; position: absolute; }.orbit-one { animation: orbit-spin 16s linear infinite; height: 350px; right: -118px; top: 117px; width: 350px; }.orbit-two { animation: orbit-spin 12s linear infinite reverse; height: 203px; left: -102px; top: 250px; width: 203px; }.welcome-close { align-items: center; background: rgba(15,10,20,.12); border: 0; border-radius: 50%; color: #37244b; cursor: pointer; display: flex; font-size: 28px; height: 35px; justify-content: center; line-height: 1; padding: 0 0 4px; position: absolute; right: 17px; top: 17px; transition: background .2s ease, transform .2s ease; width: 35px; z-index: 3; }.welcome-close:hover { background: rgba(15,10,20,.22); transform: rotate(90deg); }@keyframes welcome-arrive { from { opacity: 0; transform: translateY(25px) scale(.96); } to { opacity: 1; transform: translateY(0) scale(1); } }@keyframes orbit-spin { to { transform: rotate(360deg); } }
  @media (prefers-reduced-motion: reduce) { .welcome-hub, .orbit-one, .orbit-two { animation: none; }.health-check-launch:hover, .health-check-launch:hover .health-check-arrow { transform: none; } }
  @media (max-width: 680px) { .welcome-backdrop { padding: 14px; }.welcome-hub { grid-template-columns: 1fr; max-width: 475px; }.welcome-content { padding: 37px 28px; }.welcome-content h2 { font-size: 52px; }.welcome-pet-stack { min-height: 292px; }.welcome-cat { height: 188px; left: 11%; top: 34px; width: 158px; }.welcome-dog { bottom: 27px; height: 183px; right: 11%; width: 153px; }.welcome-close { background: rgba(255,255,255,.45); } }
`;
