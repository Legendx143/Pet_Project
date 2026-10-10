import { useCallback, useEffect, useRef, useState } from "react";
import { isSupabaseConfigured, supabase } from "./supabaseClient.js";

const BACKEND_URL = "http://localhost:3001";
const MAX_MEDIA_BYTES = 8 * 1024 * 1024;
const timeReference = /\b(since|for|today|yesterday|this morning|last night|hour|hours|day|days|week|weeks|month|months|morning|afternoon|evening)\b/i;

function containsTimeline(text) {
  return timeReference.test(text);
}

function Icon({ children }) {
  return <span className="dashboard-icon" aria-hidden="true">{children}</span>;
}

function formatDate(value) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}


export default function PetCareDashboard() {
  const [authUser, setAuthUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [history, setHistory] = useState([]);
  const [historyError, setHistoryError] = useState("");
  const [assessment, setAssessment] = useState(null);
  const [stage, setStage] = useState("intake");
  const [species, setSpecies] = useState("cat");
  const [age, setAge] = useState("");
  const [breed, setBreed] = useState("");
  const [description, setDescription] = useState("");
  const [imageFile, setImageFile] = useState(null);
  const [symptomVoice, setSymptomVoice] = useState(null);
  const [onsetText, setOnsetText] = useState("");
  const [onsetVoice, setOnsetVoice] = useState(null);
  const [recordingTarget, setRecordingTarget] = useState(null);
  const [formError, setFormError] = useState("");
  const [copied, setCopied] = useState(false);
  const [vetModalOpen, setVetModalOpen] = useState(false);
  const recorderRef = useRef(null);
  const recognitionRef = useRef(null);
  const accountMenuRef = useRef(null);

  const loadHistory = useCallback(async () => {
    if (!supabase || !authUser) return;
    try {
      // Try the local Express backend first
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (token) {
        const resp = await fetch(`${BACKEND_URL}/api/history`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (resp.ok) {
          const json = await resp.json();
          setHistory(json.history || []);
          setHistoryError("");
          return;
        }
      }
    } catch {
      // Backend unreachable — fall through to direct Supabase query
    }
    // Fallback: query Supabase directly via RLS
    const { data, error } = await supabase
      .from("assessments")
      .select("id, species, pet_age, breed, symptom_text, transcript, onset_text, onset_transcript, image_path, probable_conditions, triage, triage_reason, monitoring_plan, safety_note, status, created_at")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) {
      setHistoryError("We could not load your saved assessment history.");
      return;
    }
    setHistory(data || []);
    setHistoryError("");
  }, [authUser]);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      const rawSession = localStorage.getItem("petcare_demo_session");
      if (rawSession) {
        try {
          const parsed = JSON.parse(rawSession);
          if (parsed?.user) {
            setAuthUser(parsed.user);
            setAuthLoading(false);
            return undefined;
          }
        } catch {
          // ignore
        }
      }
      window.location.replace("/");
      return undefined;
    }

    let active = true;
    const loadUser = async () => {
      const { data, error } = await supabase.auth.getUser();
      if (!active) return;
      if (error || !data.user) {
        window.location.replace("/");
        return;
      }
      setAuthUser(data.user);
      setAuthLoading(false);
    };

    loadUser();
    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") window.location.replace("/");
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!authUser) return undefined;
    loadHistory();
    if (!supabase) return undefined;
    const channel = supabase
      .channel(`assessment-history-${authUser.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "assessments", filter: `user_id=eq.${authUser.id}` },
        loadHistory,
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [authUser, loadHistory]);

  useEffect(() => {
    const closeAccountMenu = (event) => {
      if (!accountMenuRef.current?.contains(event.target)) setAccountMenuOpen(false);
    };
    document.addEventListener("mousedown", closeAccountMenu);
    return () => document.removeEventListener("mousedown", closeAccountMenu);
  }, []);

  const stopRecording = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
      recognitionRef.current = null;
    }
    if (recorderRef.current?.recorder && recorderRef.current.recorder.state !== "inactive") {
      try {
        recorderRef.current.recorder.stop();
      } catch {}
    }
  }, []);

  useEffect(() => () => {
    stopRecording();
    recorderRef.current?.stream?.getTracks().forEach((track) => track.stop());
  }, [stopRecording]);

  const needsTimeline = !containsTimeline(description) || Boolean(symptomVoice);

  const startRecording = async (target) => {
    if (recordingTarget) {
      stopRecording();
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      setFormError("Voice recording is not available in this browser. Please type your message instead.");
      return;
    }

    const baseText = target === "symptom" ? description : onsetText;

    // Real-time Speech-to-Text Speech Recognition
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      try {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = "en-US";

        recognition.onresult = (event) => {
          let accumulatedFinal = "";
          let interim = "";
          for (let i = 0; i < event.results.length; i++) {
            const res = event.results[i];
            if (res.isFinal) {
              accumulatedFinal += res[0].transcript + " ";
            } else {
              interim += res[0].transcript;
            }
          }
          const spokenText = (accumulatedFinal + interim).trim();
          const combined = baseText ? `${baseText.trim()} ${spokenText}` : spokenText;

          if (target === "symptom") {
            setDescription(combined);
          } else {
            setOnsetText(combined);
          }
          setFormError("");
        };

        recognition.onerror = (err) => {
          console.log("Speech recognition error:", err);
        };

        recognition.onend = () => {
          recognitionRef.current = null;
        };

        recognitionRef.current = recognition;
        recognition.start();
      } catch (err) {
        console.log("SpeechRecognition start error:", err);
      }
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const chunks = [];
      const recorder = new MediaRecorder(stream, { mimeType: MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : undefined });
      recorder.ondataavailable = (event) => {
        if (event.data.size) chunks.push(event.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        if (recognitionRef.current) {
          try { recognitionRef.current.stop(); } catch {}
          recognitionRef.current = null;
        }
        const voice = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
        if (voice.size) {
          if (target === "symptom") setSymptomVoice(voice);
          else setOnsetVoice(voice);
        }
        setRecordingTarget(null);
      };
      recorderRef.current = { recorder, stream };
      setRecordingTarget(target);
      setFormError("");
      recorder.start();
    } catch {
      stopRecording();
      setFormError("Microphone access was not available. You can type the details instead.");
    }
  };

  // uploadMedia is no longer needed — the backend handles file uploads.
  // Files are sent directly via FormData to the Express server.

  const saveDemoHistory = (newAssessment) => {
    if (!authUser) return;
    try {
      const key = `petcare_history_${authUser.id}`;
      const existing = JSON.parse(localStorage.getItem(key) || "[]");
      const updated = [newAssessment, ...existing];
      localStorage.setItem(key, JSON.stringify(updated));
      setHistory(updated);
    } catch {}
  };

  const generateFallbackAssessment = ({ speciesVal, ageVal, breedVal, descVal, onsetVal }) => {
    const text = (descVal || "").toLowerCase();
    const isUrgent = /collapse|seizure|bleeding|unresponsive|poison|choking|cannot breathe|difficulty breathing/i.test(text);
    const isConsult = /vomit|diarrhea|limping|scratching|blood|pain|fever|cough|eye|ear/i.test(text);

    const triage = isUrgent ? "URGENT" : isConsult ? "CONSULT" : "MONITOR";
    const speciesTitle = speciesVal.charAt(0).toUpperCase() + speciesVal.slice(1);
    const onsetStr = (onsetVal || "").trim() || "recently";

    return {
      id: crypto.randomUUID(),
      user_id: authUser?.id || "demo-user",
      species: speciesVal,
      pet_age: ageVal,
      breed: (breedVal || "").trim() || undefined,
      symptom_text: (descVal || "").trim(),
      onset_text: onsetStr,
      status: "complete",
      created_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
      probable_conditions: [
        {
          name: `Mild ${speciesTitle} Health Irritation`,
          explanation: `Observed symptoms starting ${onsetStr} are consistent with mild environmental or digestive factors in a ${ageVal}-year-old ${speciesVal}.`,
          likelihood: "more consistent"
        },
        {
          name: "Dietary or Sensitivity Reaction",
          explanation: "Temporary stomach or skin sensitivity caused by recent food or environmental changes.",
          likelihood: "possible"
        },
        {
          name: "General Stress or Mild Fatigue",
          explanation: "Changes in routine or activity levels can temporarily affect energy and appetite.",
          likelihood: "less consistent"
        }
      ],
      triage,
      triage_reason: isUrgent
        ? "Critical warning signs detected. Emergency veterinary evaluation is recommended."
        : isConsult
        ? "Symptoms warrant a professional veterinary consultation in the near future."
        : "Symptoms appear mild without immediate red flags. Monitor closely over the next 24 hours.",
      monitoring_plan: {
        care_steps: [
          "Provide a quiet, comfortable resting environment.",
          "Ensure clean, fresh drinking water is accessible at all times.",
          "Observe food intake and activity closely over the next 24 hours.",
          "Avoid sudden food changes or unprescribed human medications."
        ],
        nutritional_considerations: [
          {
            nutrient_or_support: "Hydration Support",
            why_it_may_help: "Maintains optimal fluid balance and supports recovery.",
            pet_safe_way_to_offer: "Offer fresh water or plain pet-safe broth."
          },
          {
            nutrient_or_support: "Digestive Support",
            why_it_may_help: "Eases digestive workload while resting.",
            pet_safe_way_to_offer: "Offer small portions of plain, unseasoned cooked lean protein."
          }
        ],
        warning_signs: [
          "Lethargy or severe weakness",
          "Refusal of water for more than 12-24 hours",
          "Repeated vomiting or severe diarrhea",
          "Difficulty breathing or pale gums"
        ]
      },
      safety_note: "This automated guidance is for supportive reference only and is not a veterinary diagnosis. Consult a licensed veterinarian for medical guidance."
    };
  };

  const startAssessment = async () => {
    const numericAge = Number(age);
    if (!Number.isInteger(numericAge) || numericAge < 0 || numericAge > 40) {
      setFormError("Enter your pet's age before starting the assessment.");
      return;
    }
    if (!description.trim() && !symptomVoice && !imageFile) {
      setFormError("Add text, a voice note, or a photo to continue.");
      return;
    }
    if (needsTimeline && !onsetText.trim() && !onsetVoice) {
      setFormError("Tell us when the symptoms started, using text or a short voice answer.");
      return;
    }

    setFormError("");
    setStage("analysing");
    try {
      let token = null;
      if (supabase) {
        const { data: sessionData } = await supabase.auth.getSession();
        token = sessionData?.session?.access_token;
      } else {
        const rawSession = localStorage.getItem("petcare_demo_session");
        if (rawSession) {
          try {
            const parsed = JSON.parse(rawSession);
            token = parsed?.access_token || "demo-token";
          } catch {
            token = "demo-token";
          }
        } else {
          token = "demo-token";
        }
      }

      const formData = new FormData();
      formData.append("species", species);
      formData.append("age", String(numericAge));
      formData.append("breed", breed);
      formData.append("symptomText", description);
      formData.append("onsetText", onsetText);

      if (symptomVoice) {
        formData.append("symptomAudio", symptomVoice, "symptoms.webm");
      }
      if (imageFile) {
        formData.append("image", imageFile, imageFile.name || "photo.jpg");
      }
      if (onsetVoice) {
        formData.append("onsetAudio", onsetVoice, "onset.webm");
      }

      let assessmentResult = null;
      try {
        const response = await fetch(`${BACKEND_URL}/api/assess`, {
          method: "POST",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          body: formData,
        });

        const data = await response.json();
        if (response.ok && data.assessment) {
          assessmentResult = data.assessment;
        } else if (!token.startsWith("demo-token")) {
          throw new Error(data.error || "The assessment service is unavailable.");
        }
      } catch (err) {
        if (!token.startsWith("demo-token")) {
          throw new Error(err instanceof Error ? err.message : "The assessment could not be completed.");
        }
      }

      if (!assessmentResult) {
        assessmentResult = generateFallbackAssessment({
          speciesVal: species,
          ageVal: numericAge,
          breedVal: breed,
          descVal: description,
          onsetVal: onsetText,
        });
        saveDemoHistory(assessmentResult);
      }

      setAssessment(assessmentResult);
      setStage("result");
      loadHistory();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "The assessment could not be completed.");
      setStage("intake");
    }
  };

  const openHistoryItem = (item) => {
    if (item.status !== "complete") return;
    setAssessment(item);
    setSpecies(item.species);
    setHistoryOpen(false);
    setStage("result");
  };

  const resetAssessment = () => {
    setAssessment(null);
    setAge("");
    setBreed("");
    setDescription("");
    setImageFile(null);
    setSymptomVoice(null);
    setOnsetText("");
    setOnsetVoice(null);
    setFormError("");
    setStage("intake");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const signOut = async () => {
    if (localStorage.getItem("petcare_demo_session")) {
      localStorage.removeItem("petcare_demo_session");
      window.location.assign("/");
      return;
    }
    if (supabase) {
      await supabase.auth.signOut();
    }
    window.location.assign("/");
  };

  const copyVetSummary = async () => {
    if (!assessment) return;
    const conditions = (assessment.probable_conditions || []).map((item) => item.name).join(", ");
    const onset = assessment.onset_text || assessment.onset_transcript || "not provided";
    const summary = `${assessment.species} age ${assessment.pet_age}. Symptoms: ${assessment.symptom_text || assessment.transcript || "not provided"}. Began: ${onset}. Triage: ${assessment.triage}. Possible explanations: ${conditions}.`;
    try {
      await navigator.clipboard.writeText(summary);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  if (authLoading || !authUser) {
    return <main className="dashboard-auth-loading">Checking your secure Pet-Care session…</main>;
  }

  const email = authUser.email || "Pet-Care member";
  const initial = email.charAt(0).toUpperCase();
  const conditions = assessment?.probable_conditions || [];
  const plan = assessment?.monitoring_plan || { care_steps: [], nutritional_considerations: [], warning_signs: [] };

  const defaultWarningSigns = [
    "Lethargy, extreme weakness, or unresponsiveness",
    "Refusal of water or food for more than 12-24 hours",
    "Repeated vomiting, severe diarrhea, or blood in stool",
    "Difficulty breathing, rapid panting, or pale/blue gums",
    "Sudden collapse, seizures, or signs of severe pain"
  ];

  const rawWarningSigns = plan.warning_signs || [];
  const warningSigns = Array.isArray(rawWarningSigns) && rawWarningSigns.length > 0
    ? rawWarningSigns
    : defaultWarningSigns;

  return (
    <div className="dashboard-page">
      <style>{dashboardStyles}</style>
      <header className="dashboard-header">
        <a className="dashboard-brand" href="/" aria-label="Return to Pet-Care home"><img src="/pet-care-logo.png" alt="Pet-Care Logo" className="brand-logo-img" /> Pet-Care</a>
        <div className="dashboard-header-right">
          <button className="history-button" type="button" onClick={() => setHistoryOpen(true)}>History</button>
          <button className="new-check-button" type="button" onClick={resetAssessment}>+ New check-in</button>
          <div className="account-menu" ref={accountMenuRef}>
            <button className="account-avatar" type="button" aria-label="Open account menu" aria-expanded={accountMenuOpen} onClick={() => setAccountMenuOpen((open) => !open)}>{initial}</button>
            {accountMenuOpen && <div className="account-popover" role="menu"><p>Signed in as</p><strong title={email}>{email}</strong><button type="button" role="menuitem" onClick={signOut}>Sign out</button></div>}
          </div>
        </div>
      </header>

      <main className="dashboard-main">
        <section className="dashboard-content">
          {stage === "intake" && <section className="assessment-intake">
            <p className="dashboard-eyebrow">PRIVATE PET HEALTH CHECK-IN</p>
            <h1>What’s going on with your pet?</h1>
            <p className="intro-copy">Share your observations as text, a voice note, or a photo. Pet-Care returns supportive information—not a diagnosis—and saves the result privately to your history.</p>
            <div className="input-layout">
              <section className="intake-card pet-profile-card glass-3d">
                <div className="card-heading"><Icon>♡</Icon><div><h2>Pet information</h2><p>A little context goes a long way.</p></div></div>
                <div className="species-toggle" aria-label="Pet species"><button className={species === "cat" ? "selected" : ""} onClick={() => setSpecies("cat")} type="button">Cat</button><button className={species === "dog" ? "selected" : ""} onClick={() => setSpecies("dog")} type="button">Dog</button></div>
                
                {/* Dynamic 3D Pet Showcase Container */}
                <div className="pet-visual-showcase">
                  <div className="pet-avatar-frame">
                    <img
                      key={species}
                      src={
                        species === "cat"
                          ? "https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?auto=format&fit=crop&w=600&q=80"
                          : "https://images.unsplash.com/photo-1543466835-00a7907e9de1?auto=format&fit=crop&w=600&q=80"
                      }
                      alt={species === "cat" ? "Cat" : "Dog"}
                      className="pet-showcase-img"
                    />
                    <div className="pet-glass-reflection"></div>
                  </div>
                </div>

                <div className="two-fields"><label>Age <input type="number" min="0" max="40" placeholder="e.g. 3" value={age} onChange={(event) => setAge(event.target.value)} /></label><label>Breed <input type="text" placeholder="Optional" value={breed} onChange={(event) => setBreed(event.target.value)} /></label></div>
              </section>

              <section className="intake-card symptom-card glass-3d">
                <div className="card-heading prominent-heading"><Icon>✎</Icon><div><h2>Describe the change</h2><p>What are you seeing? Include when it began if you know.</p></div></div>
                <textarea maxLength="2000" value={description} onChange={(event) => { setDescription(event.target.value); setFormError(""); }} placeholder={`Example: My ${species} has been vomiting since yesterday and isn’t eating.`} />
                <div className="input-tools">
                  <button type="button" className={recordingTarget === "symptom" ? "voice-button recording" : symptomVoice ? "voice-button captured" : "voice-button"} onClick={() => startRecording("symptom")}>
                    <span aria-hidden="true">
                      {recordingTarget === "symptom" ? "■" : (
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ display: "inline-block" }}>
                          <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
                          <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                          <line x1="12" y1="19" x2="12" y2="22" />
                        </svg>
                      )}
                    </span>
                    {recordingTarget === "symptom" ? "Recording… tap to stop" : "Voice Description"}
                  </button>
                  <span>{description.length}/2000</span>
                </div>
              </section>

              <section className="intake-card image-card glass-3d">
                <div className="card-heading prominent-heading"><Icon>◉</Icon><div><h2>Add a photo <em>optional</em></h2><p>Visible changes can add context.</p></div></div>
                <label className={imageFile ? "upload-area attached" : "upload-area"}><input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => { const file = event.target.files?.[0] || null; if (file && file.size > MAX_MEDIA_BYTES) setFormError("Images must be 8 MB or smaller."); else { setImageFile(file); setFormError(""); } }} /><span className="upload-symbol">{imageFile ? "✓" : "+"}</span><strong>{imageFile ? imageFile.name : "Upload JPG, PNG, or WebP"}</strong><small>Private to your account · max 8 MB</small></label>
              </section>
            </div>

            {needsTimeline && <section className="timeline-card glass-3d"><div><p className="dashboard-eyebrow">ONE HELPFUL DETAIL</p><h2>When did you first notice this?</h2><p>If the text or voice note does not include a time, add it here so the AI can give safer guidance.</p></div><div className="timeline-input"><input value={onsetText} onChange={(event) => { setOnsetText(event.target.value); setFormError(""); }} placeholder="e.g. Yesterday afternoon" /><button className={recordingTarget === "onset" ? "question-voice recording" : onsetVoice ? "question-voice captured" : "question-voice"} type="button" onClick={() => startRecording("onset")} aria-label="Record when symptoms began">{recordingTarget === "onset" ? "■" : onsetVoice ? "✓" : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ display: "inline-block" }}><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" /><line x1="12" y1="19" x2="12" y2="22" /></svg>}</button></div></section>}
            {formError && <p className="dashboard-error" role="alert">{formError}</p>}
            <div className="assessment-footer"><p><span>✦</span> Your files and history are private to your account.</p><button className="assessment-button" type="button" onClick={startAssessment}>Get supportive guidance <span>→</span></button></div>
          </section>}

          {stage === "analysing" && (
            <section className="analysing-state" aria-live="polite">
              <div className="analysing-card glass-3d">
                <div className="analysis-3d-stage">
                  <div className="analysis-3d-sphere">
                    <div className="sphere-core">
                      <span>✦</span>
                    </div>
                    <div className="ring ring-1"></div>
                    <div className="ring ring-2"></div>
                    <div className="ring ring-3"></div>
                    <div className="sphere-glow"></div>
                  </div>
                </div>

                <p className="dashboard-eyebrow glowing-eyebrow">✦ ANALYSING PRIVATE INPUT ✦</p>
                <h1 className="analysing-title">Taking a thoughtful look…</h1>

                <div className="analysis-steps-container">
                  <div className="step-chip">
                    <span className="chip-dot"></span> Transcribing voice & text
                  </div>
                  <div className="step-chip">
                    <span className="chip-dot"></span> Evaluating visual markers
                  </div>
                  <div className="step-chip">
                    <span className="chip-dot"></span> Preparing veterinary triage
                  </div>
                </div>

                <div className="analysis-wave-3d">
                  <i /><i /><i /><i /><i /><i /><i />
                </div>
              </div>
            </section>
          )}

          {stage === "result" && assessment && <section className="result-state">
            <div className="result-heading">
              <div>
                <p className="dashboard-eyebrow">SAVED ASSESSMENT</p>
                <h1>Here’s a clearer picture.</h1>
                <p>This is supportive information, not a diagnosis. Contact a veterinarian if you are worried or symptoms continue.</p>
              </div>
              <div className="result-heading-actions">
                <button className="outline-dashboard-button" type="button" onClick={copyVetSummary}>
                  {copied ? "Copied for your vet" : "Copy vet summary"} <span>↗</span>
                </button>
                <button className="outline-dashboard-button contact-vet-btn" type="button" onClick={() => setVetModalOpen(true)}>
                  Contact Veterinarian <span>🩺</span>
                </button>
              </div>
            </div>
            <div className="evidence-strip"><span>Information considered</span><b>{assessment.species}</b><b>Age {assessment.pet_age}</b>{(assessment.symptom_text || assessment.transcript) && <i>Symptoms</i>}{(assessment.onset_text || assessment.onset_transcript) && <i>Timeline</i>}{assessment.image_path && <i>Image</i>}</div>
            <div className="result-grid"><section className="conditions-panel glass-3d"><div className="panel-title"><div><p>TOP THREE POSSIBILITIES</p><h2>What could be involved</h2></div><span>NOT A DIAGNOSIS</span></div><ol className="condition-list">{conditions.map((condition, index) => <li key={`${condition.name}-${index}`}><span className="rank">0{index + 1}</span><div><h3>{condition.name}</h3><p>{condition.explanation}</p><small>{condition.likelihood}</small></div></li>)}</ol></section><aside className={`triage-panel triage-${assessment.triage?.toLowerCase()} glass-3d`}><p>VETERINARY TRIAGE</p><span className="triage-ring">{assessment.triage === "URGENT" ? "!" : assessment.triage === "CONSULT" ? "•" : "✓"}</span><h2>{assessment.triage}</h2><strong>{assessment.triage_reason}</strong><p className="triage-note">{assessment.safety_note}</p></aside></div>
            {assessment.triage === "MONITOR" && <section className="care-guidance glass-3d"><div><p className="dashboard-eyebrow">MONITORING SUPPORT</p><h2>Safe next steps while you monitor.</h2><p>These are nutritional considerations, not confirmed nutrient deficiencies. Do not give supplements or human medication without veterinary advice.</p></div><div className="care-columns"><div><h3>Supportive care</h3><ul>{plan.care_steps.map((step) => <li key={step}>{step}</li>)}</ul></div><div><h3>Potential nutritional support</h3><ul>{plan.nutritional_considerations.map((item) => <li key={item.nutrient_or_support}><strong>{item.nutrient_or_support}:</strong> {item.pet_safe_way_to_offer}</li>)}</ul></div></div></section>}
            {assessment.triage !== "URGENT" && <section className="warning-card glass-3d"><h2>Seek urgent care if you notice</h2><ul>{warningSigns.map((sign, index) => <li key={typeof sign === "string" ? sign : index}>{typeof sign === "string" ? sign : (sign?.sign || sign?.description || String(sign))}</li>)}</ul></section>}
            <div className="result-bottom"><p>✦ This assessment is saved in your private history.</p><button type="button" onClick={resetAssessment}>Start a new assessment →</button></div>
          </section>}
        </section>
      </main>

      {historyOpen && <div className="history-backdrop" onMouseDown={() => setHistoryOpen(false)} role="presentation"><aside className="history-panel glass-3d" onMouseDown={(event) => event.stopPropagation()} aria-label="Assessment history"><div className="history-heading"><div><p className="dashboard-eyebrow">YOUR PRIVATE RECORD</p><h2>Assessment history</h2></div><button type="button" onClick={() => setHistoryOpen(false)} aria-label="Close history">×</button></div>{historyError && <p className="dashboard-error">{historyError}</p>}{!history.length && !historyError && <p className="history-empty">Your completed check-ins will appear here.</p>}<ol className="history-list">{history.map((item) => <li key={item.id}><button type="button" onClick={() => openHistoryItem(item)} disabled={item.status !== "complete"}><span>{formatDate(item.created_at)}</span><strong>{item.species === "cat" ? "Cat" : "Dog"} · {item.triage || "Processing"}</strong><p>{item.symptom_text || item.transcript || "Voice or image assessment"}</p></button></li>)}</ol></aside></div>}

      {vetModalOpen && (
        <div className="history-backdrop vet-modal-backdrop" onMouseDown={() => setVetModalOpen(false)} role="presentation">
          <div className="vet-modal-card glass-3d" onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-label="Contact Veterinarian">
            <button type="button" className="vet-modal-close" onClick={() => setVetModalOpen(false)} aria-label="Close modal">×</button>
            <div className="vet-modal-body">
              <div className="vet-img-wrapper">
                <img src="/pet-doctor.png" alt="Pet Doctor" className="vet-doctor-img" />
              </div>
              <h2>Contact Veterinarian</h2>
              <p className="vet-modal-message">This service will be enable soon.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const dashboardStyles = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=DM+Sans:wght@400;500;600;700&family=Fraunces:opsz,wght@9..144,500;9..144,600&display=swap');
  * { box-sizing: border-box; } body { margin: 0; background: #0c0912; }
  button, input, textarea { font: inherit; } 
  .dashboard-auth-loading { align-items: center; background: #0c0912; color: #f7f2ff; display: flex; font: 600 16px 'DM Sans', sans-serif; justify-content: center; min-height: 100vh; }
  
  .dashboard-page { 
    background: radial-gradient(circle at 50% -20%, #291a3f 0%, #110c1a 60%, #08050e 100%);
    color: #f7f2ff; 
    font-family: 'DM Sans', sans-serif; 
    min-height: 100vh; 
  }
  
  .dashboard-header { 
    align-items: center; 
    background: rgba(16, 12, 24, 0.75); 
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border-bottom: 1px solid rgba(224, 208, 255, 0.12); 
    display: flex; 
    height: 76px; 
    justify-content: space-between; 
    padding: 0 clamp(18px,5vw,76px); 
    position: sticky; 
    top: 0; 
    z-index: 20; 
    box-shadow: 0 10px 30px rgba(0,0,0,0.3);
  }
  
  .dashboard-brand { 
    align-items: center; 
    color: #fbf7ff; 
    display: inline-flex; 
    font-size: 20px; 
    font-weight: 700; 
    gap: 9px; 
    text-decoration: none; 
  }
  .brand-logo-img { 
    height: 38px; 
    width: 38px; 
    object-fit: contain;
    filter: drop-shadow(0 4px 12px rgba(183, 142, 255, 0.5));
    transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  }
  .dashboard-brand:hover .brand-logo-img {
    transform: scale(1.12) rotate(4deg);
  }

  .dashboard-header-right { align-items: center; display: flex; gap: 12px; }
  
  .history-button, .new-check-button { 
    background: rgba(255, 255, 255, 0.05); 
    backdrop-filter: blur(10px);
    border: 1px solid rgba(222, 207, 255, 0.3); 
    border-radius: 999px; 
    color: #f4edff; 
    cursor: pointer; 
    font-size: 12px; 
    font-weight: 700; 
    padding: 10px 16px; 
    transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
    box-shadow: 0 4px 15px rgba(0,0,0,0.15);
  }
  .history-button:hover {
    background: rgba(255, 255, 255, 0.12);
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(180, 135, 255, 0.2);
  }
  
  .new-check-button { 
    background: linear-gradient(135deg, #d8c0ff, #b58fff); 
    border-color: transparent; 
    color: #1a1025; 
    box-shadow: 0 6px 20px rgba(181, 143, 255, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.5);
  }
  .new-check-button:hover {
    transform: translateY(-2px) scale(1.02);
    box-shadow: 0 8px 25px rgba(181, 143, 255, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.6);
  }
  
  .account-menu { position: relative; }
  
  .account-avatar { 
    align-items: center; 
    background: linear-gradient(135deg, #d8c0ff, #a977ff); 
    border: 2px solid rgba(255, 255, 255, 0.5); 
    border-radius: 50%; 
    color: #21172c; 
    cursor: pointer; 
    display: flex; 
    font-weight: 800; 
    height: 38px; 
    justify-content: center; 
    width: 38px; 
    box-shadow: 0 4px 14px rgba(0,0,0,0.3);
    transition: transform 0.2s ease;
  }
  .account-avatar:hover { transform: scale(1.08); }
  
  .account-popover { 
    background: rgba(255, 253, 253, 0.92); 
    backdrop-filter: blur(20px);
    border: 1px solid rgba(216, 201, 232, 0.7); 
    border-radius: 16px; 
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.35), 0 0 0 1px rgba(255, 255, 255, 0.5); 
    color: #2c2235; 
    min-width: 235px; 
    padding: 16px; 
    position: absolute; 
    right: 0; 
    top: calc(100% + 12px); 
    z-index: 22; 
    animation: fadeInScale 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  }
  @keyframes fadeInScale { from { opacity: 0; transform: scale(0.95) translateY(-8px); } to { opacity: 1; transform: scale(1) translateY(0); } }
  
  .account-popover p { color: #786b88; font: 9px 'DM Mono', monospace; letter-spacing: .7px; margin: 0 0 6px; text-transform: uppercase; }
  .account-popover strong { display: block; font-size: 13px; overflow: hidden; padding-bottom: 13px; text-overflow: ellipsis; white-space: nowrap; }
  .account-popover button { background: #261d30; border: 0; border-radius: 8px; color: #fffaff; cursor: pointer; font-size: 12px; font-weight: 700; padding: 10px 12px; width: 100%; transition: background 0.2s ease; }
  .account-popover button:hover { background: #3c2f4a; }

  .dashboard-main { margin: 0 auto; max-width: 1320px; padding: clamp(28px,5vw,70px) clamp(16px,4vw,54px) 64px; }
  
  .dashboard-content { 
    background: radial-gradient(circle at 85% -10%, rgba(200, 160, 255, 0.25), transparent 30rem), rgba(245, 241, 249, 0.94); 
    backdrop-filter: blur(25px);
    -webkit-backdrop-filter: blur(25px);
    border-radius: 30px; 
    border: 1px solid rgba(255, 255, 255, 0.7);
    box-shadow: 0 30px 70px -15px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.8);
    color: #282033; 
    min-height: 680px; 
    padding: clamp(25px,5vw,62px); 
  }
  
  .dashboard-eyebrow { color: #71509f; font: 10px 'DM Mono', monospace; letter-spacing: 1px; margin: 0 0 14px; }
  .assessment-intake > h1, .result-heading h1, .analysing-state h1 { font-family: Fraunces, Georgia, serif; font-size: clamp(40px,5vw,63px); font-weight: 500; letter-spacing: -2px; line-height: 1.03; margin: 0 0 14px; }
  .intro-copy { color: #5f5569; font-size: 16px; line-height: 1.65; margin: 0 0 30px; max-width: 680px; }

  /* 3D Glassmorphism Cards */
  .input-layout { display: grid; gap: 18px; grid-template-columns: 310px minmax(0,1fr); }
  
  .intake-card { 
    background: rgba(255, 253, 253, 0.82); 
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    border: 1px solid rgba(223, 211, 234, 0.8); 
    border-radius: 20px; 
    padding: 24px; 
    box-shadow: 0 12px 30px -8px rgba(100, 60, 160, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.9);
    transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.3s ease;
  }
  .intake-card:hover {
    transform: translateY(-3px);
    box-shadow: 0 20px 40px -10px rgba(100, 60, 160, 0.14), inset 0 1px 0 rgba(255, 255, 255, 1);
  }

  /* Black Pet Information Card with Glass & 3D Visual */
  .pet-profile-card { 
    background: linear-gradient(155deg, rgba(35, 27, 43, 0.96) 0%, rgba(18, 13, 24, 0.98) 100%); 
    backdrop-filter: blur(20px);
    border: 1px solid rgba(216, 185, 255, 0.25);
    color: #fff; 
    grid-row: span 2; 
    box-shadow: 0 25px 50px -10px rgba(0,0,0,0.5), inset 0 1px 1px rgba(255, 255, 255, 0.2);
    display: flex;
    flex-direction: column;
    justify-content: space-between;
  }

  .card-heading { align-items: flex-start; display: flex; gap: 12px; margin-bottom: 18px; }
  .dashboard-icon { color: #a97cf0; font-size: 21px; }
  .card-heading h2 { color: #2a2034; font-size: 17px; margin: 0 0 4px; font-weight: 700; }
  .pet-profile-card .card-heading h2 { color: #fffaff; }
  .card-heading p { color: #776e7d; font-size: 12.5px; margin: 0; }
  .pet-profile-card .card-heading p { color: #c4b7ce; }
  .card-heading em { color: #8e62ce; font: 10px 'DM Mono', monospace; font-style: normal; letter-spacing: .5px; font-weight: bold; margin-left: 4px; }

  /* PROMINENT TEXT SIZES FOR DESCRIBE CHANGE & ADD PHOTO */
  .prominent-heading h2 {
    font-size: 21px !important;
    font-weight: 700 !important;
    line-height: 1.25 !important;
    color: #1f1629 !important;
    letter-spacing: -0.3px;
  }
  .prominent-heading p {
    font-size: 14.5px !important;
    font-weight: 500 !important;
    color: #5c4f69 !important;
    line-height: 1.45 !important;
    margin-top: 3px !important;
  }

  /* Dynamic 3D Pet Visual Showcase Box with Glassmorphism */
  .pet-visual-showcase {
    margin: 16px 0 20px;
    perspective: 1000px;
  }
  .pet-avatar-frame {
    position: relative;
    width: 100%;
    height: 185px;
    border-radius: 20px;
    overflow: hidden;
    background: linear-gradient(135deg, rgba(255, 255, 255, 0.12) 0%, rgba(255, 255, 255, 0.03) 100%);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border: 1.5px solid rgba(255, 255, 255, 0.35);
    box-shadow: 
      0 20px 45px -10px rgba(0, 0, 0, 0.65),
      0 0 35px rgba(183, 142, 255, 0.2),
      inset 0 1px 2px rgba(255, 255, 255, 0.5),
      inset 0 -1px 3px rgba(0, 0, 0, 0.4);
    transform-style: preserve-3d;
    transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.4s ease, border-color 0.3s ease;
  }
  .pet-avatar-frame:hover {
    transform: translateY(-4px) rotateX(4deg) rotateY(-4deg) scale(1.02);
    border-color: rgba(230, 205, 255, 0.7);
    box-shadow: 
      0 30px 60px -12px rgba(0, 0, 0, 0.8),
      0 0 50px rgba(198, 155, 255, 0.4),
      inset 0 1px 3px rgba(255, 255, 255, 0.7);
  }
  .pet-showcase-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
    animation: imageFadeIn 0.4s ease-out;
  }
  .pet-glass-reflection {
    position: absolute;
    inset: 0;
    pointer-events: none;
    background: linear-gradient(135deg, rgba(255, 255, 255, 0.25) 0%, rgba(255, 255, 255, 0) 50%, rgba(0, 0, 0, 0.15) 100%);
    border-radius: 20px;
  }
  @keyframes imageFadeIn {
    from { opacity: 0; transform: scale(1.08); }
    to { opacity: 1; transform: scale(1); }
  }

  .species-toggle { 
    background: rgba(15, 11, 20, 0.85); 
    border: 1px solid rgba(110, 85, 140, 0.5); 
    border-radius: 12px; 
    display: grid; 
    grid-template-columns: 1fr 1fr; 
    padding: 4px; 
    box-shadow: inset 0 2px 5px rgba(0,0,0,0.4);
  }
  .species-toggle button { 
    background: transparent; 
    border: 0; 
    border-radius: 8px; 
    color: #c8bdd5; 
    cursor: pointer; 
    font-weight: 700; 
    font-size: 13px;
    padding: 10px; 
    transition: all 0.25s ease;
  }
  .species-toggle button.selected { 
    background: linear-gradient(135deg, #d8c0ff, #b58fff); 
    color: #1c1328; 
    box-shadow: 0 4px 15px rgba(181, 143, 255, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.6);
    transform: translateY(-1px);
  }

  .two-fields { display: grid; gap: 11px; grid-template-columns: 1fr 1fr; margin-top: 14px; }
  .two-fields label { color: #d7ccdf; display: grid; font-size: 11px; font-weight: 700; gap: 7px; }
  .two-fields input, .timeline-input input { 
    background: rgba(42, 34, 50, 0.8); 
    border: 1px solid rgba(100, 80, 120, 0.6); 
    border-radius: 10px; 
    color: #fff; 
    height: 42px; 
    min-width: 0; 
    outline: none; 
    padding: 0 12px; 
    width: 100%; 
    transition: border-color 0.2s ease, box-shadow 0.2s ease;
  }
  .two-fields input:focus, .timeline-input input:focus {
    border-color: #b78eff;
    box-shadow: 0 0 0 3px rgba(183, 142, 255, 0.25);
  }

  .symptom-card textarea { 
    background: rgba(245, 241, 249, 0.85); 
    border: 1.5px solid rgba(217, 204, 229, 0.9); 
    border-radius: 14px; 
    color: #2a2133; 
    font: inherit; 
    font-size: 15px;
    height: 175px; 
    line-height: 1.6; 
    outline: none; 
    padding: 15px; 
    resize: vertical; 
    width: 100%; 
    box-shadow: inset 0 2px 4px rgba(0,0,0,0.03);
    transition: border-color 0.2s ease, box-shadow 0.2s ease;
  }
  .symptom-card textarea:focus {
    border-color: #9c71d6;
    box-shadow: 0 0 0 3px rgba(156, 113, 214, 0.2), inset 0 2px 4px rgba(0,0,0,0.03);
  }

  .input-tools { align-items: center; color: #786c84; display: flex; font-size: 11px; justify-content: space-between; margin-top: 12px; }
  .voice-button { 
    align-items: center; 
    background: rgba(141, 105, 194, 0.08); 
    border: 1px solid rgba(141, 105, 194, 0.3); 
    border-radius: 999px;
    color: #7349b1; 
    cursor: pointer; 
    display: flex; 
    font-size: 12px; 
    font-weight: 700; 
    gap: 8px; 
    padding: 6px 14px; 
    transition: all 0.2s ease;
  }
  .voice-button:hover {
    background: rgba(141, 105, 194, 0.16);
    transform: translateY(-1px);
  }
  .voice-button span { align-items: center; border: 1px solid #8d69c2; border-radius: 50%; display: flex; height: 21px; justify-content: center; width: 21px; }
  .voice-button.recording { color: #b13f64; border-color: #b13f64; background: rgba(177, 63, 100, 0.1); }
  .voice-button.captured { color: #267244; border-color: #267244; background: rgba(38, 114, 68, 0.1); }

  .image-card { 
    align-items: center; 
    background: linear-gradient(135deg, rgba(200, 160, 250, 0.9), rgba(180, 135, 245, 0.85)); 
    border: 1px solid rgba(255, 255, 255, 0.6);
    display: grid; 
    grid-template-columns: 1fr minmax(220px, .8fr); 
    gap: 18px; 
    box-shadow: 0 15px 35px -10px rgba(160, 100, 240, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.8);
  }
  .upload-area { 
    align-items: center; 
    background: rgba(255, 255, 255, 0.35);
    backdrop-filter: blur(10px);
    border: 2px dashed rgba(60, 35, 85, 0.45); 
    border-radius: 14px; 
    cursor: pointer; 
    display: flex; 
    flex-direction: column; 
    justify-content: center; 
    min-height: 125px; 
    padding: 16px; 
    text-align: center; 
    transition: all 0.25s ease;
    box-shadow: inset 0 1px 2px rgba(255,255,255,0.6);
  }
  .upload-area:hover {
    background: rgba(255, 255, 255, 0.5);
    transform: translateY(-2px);
    border-color: rgba(60, 35, 85, 0.7);
  }
  .upload-area input { height: 1px; opacity: 0; position: absolute; width: 1px; }
  .upload-area.attached { background: rgba(255, 255, 255, 0.65); border-style: solid; border-color: #593b95; }
  .upload-symbol { align-items: center; background: rgba(255,255,255,0.7); border-radius: 50%; color: #593b95; display: flex; font-size: 20px; height: 35px; justify-content: center; margin-bottom: 8px; width: 35px; box-shadow: 0 4px 10px rgba(0,0,0,0.1); }
  .upload-area strong { font-size: 13px; color: #211333; }
  .upload-area small { color: #533e66; font-size: 10.5px; margin-top: 5px; }

  .timeline-card { 
    align-items: center; 
    background: linear-gradient(135deg, rgba(228, 213, 251, 0.9), rgba(215, 195, 248, 0.85)); 
    backdrop-filter: blur(15px);
    border: 1px solid rgba(255, 255, 255, 0.7); 
    border-radius: 20px; 
    display: grid; 
    gap: 20px; 
    grid-template-columns: 1fr minmax(260px,.65fr); 
    margin-top: 18px; 
    padding: 22px; 
    box-shadow: 0 15px 35px -10px rgba(120, 80, 190, 0.15);
  }
  .timeline-card h2 { font: 500 23px Fraunces, Georgia, serif; margin: 0 0 6px; }
  .timeline-card p:not(.dashboard-eyebrow) { color: #5f4c6d; font-size: 13px; line-height: 1.5; margin: 0; }
  .timeline-input { display: flex; gap: 9px; }
  .timeline-input input { background: #fff; border-color: #bea2df; color: #2b2037; height: 48px; border-radius: 12px; font-size: 14px; }
  
  .question-voice { 
    background: #291f35; 
    border: 0; 
    border-radius: 12px; 
    color: #f2e9ff; 
    cursor: pointer; 
    min-width: 52px; 
    transition: transform 0.2s ease, background 0.2s ease;
    box-shadow: 0 4px 12px rgba(0,0,0,0.2);
  }
  .question-voice:hover { transform: scale(1.05); background: #382b48; }
  .question-voice.recording { background: #a6385c; }
  .question-voice.captured { background: #247048; }

  .dashboard-error { background: #fff0f4; border: 1px solid #eab5c6; border-radius: 12px; color: #913a56; font-size: 13px; font-weight: 700; margin: 16px 0 0; padding: 12px 16px; box-shadow: 0 4px 12px rgba(145, 58, 86, 0.1); }
  
  .assessment-footer { align-items: center; display: flex; justify-content: space-between; margin-top: 28px; }
  .assessment-footer p { color: #6f647b; font-size: 12px; margin: 0; }
  
  .assessment-button { 
    align-items: center; 
    background: linear-gradient(135deg, #261e30, #17111f); 
    border: 1px solid rgba(255, 255, 255, 0.15); 
    border-radius: 12px; 
    color: #f8f2ff; 
    cursor: pointer; 
    display: inline-flex; 
    font-size: 14px; 
    font-weight: 700; 
    gap: 13px; 
    padding: 15px 24px; 
    box-shadow: 0 10px 25px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255, 255, 255, 0.2);
    transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
  }
  .assessment-button:hover {
    transform: translateY(-2px) scale(1.01);
    box-shadow: 0 15px 35px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255, 255, 255, 0.3);
    background: linear-gradient(135deg, #32273f, #1e1728);
  }
  .assessment-button span { font-size: 18px; transition: transform 0.2s ease; }
  .assessment-button:hover span { transform: translateX(3px); }

  /* 3D SATISFYING LOADING STATE */
  .analysing-state { 
    margin: 3vh auto; 
    max-width: 490px; 
    perspective: 1200px;
    text-align: center; 
  }

  .analysing-card {
    background: linear-gradient(150deg, rgba(28, 20, 40, 0.94) 0%, rgba(14, 9, 22, 0.97) 100%);
    backdrop-filter: blur(30px);
    -webkit-backdrop-filter: blur(30px);
    border: 1.5px solid rgba(224, 195, 255, 0.35);
    border-radius: 28px;
    padding: 34px 28px 30px;
    box-shadow: 
      0 30px 70px -15px rgba(0, 0, 0, 0.7),
      0 0 50px rgba(183, 142, 255, 0.16),
      inset 0 1px 2px rgba(255, 255, 255, 0.4),
      inset 0 -1px 3px rgba(0, 0, 0, 0.5);
    transform-style: preserve-3d;
    animation: cardFloat3D 6s ease-in-out infinite alternate;
  }

  .glowing-eyebrow {
    color: #cbb2ff !important;
    font: 700 11px 'DM Mono', monospace !important;
    letter-spacing: 2px !important;
    text-shadow: 0 0 12px rgba(197, 155, 255, 0.6);
    margin-bottom: 6px !important;
  }

  .analysing-title {
    color: #ffffff !important;
    font: 500 clamp(30px, 4.2vw, 42px) Fraunces, Georgia, serif !important;
    letter-spacing: -1.2px !important;
    line-height: 1.15 !important;
    margin: 6px 0 18px !important;
    text-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
  }

  /* 3D Interactive Orbital Sphere Assembly */
  .analysis-3d-stage {
    display: flex;
    justify-content: center;
    align-items: center;
    margin-bottom: 28px;
    perspective: 800px;
  }

  .analysis-3d-sphere {
    position: relative;
    width: 140px;
    height: 140px;
    display: flex;
    justify-content: center;
    align-items: center;
    transform-style: preserve-3d;
  }

  .sphere-core {
    width: 76px;
    height: 76px;
    border-radius: 50%;
    background: radial-gradient(circle at 35% 30%, #f3ebff 0%, #b78eff 55%, #582aa4 100%);
    box-shadow: 
      0 12px 35px rgba(183, 142, 255, 0.65),
      0 0 45px rgba(164, 109, 255, 0.4),
      inset 0 2px 5px rgba(255, 255, 255, 0.9),
      inset 0 -4px 8px rgba(0, 0, 0, 0.6);
    display: flex;
    justify-content: center;
    align-items: center;
    position: relative;
    z-index: 2;
    animation: corePulse3D 3s ease-in-out infinite alternate;
  }

  .sphere-core span {
    font-size: 32px;
    color: #ffffff;
    text-shadow: 0 0 16px rgba(255, 255, 255, 1);
    animation: sparkleRotate 6s linear infinite;
  }

  .sphere-glow {
    position: absolute;
    inset: -35px;
    background: radial-gradient(circle, rgba(183, 142, 255, 0.35) 0%, rgba(118, 55, 215, 0.1) 60%, transparent 80%);
    border-radius: 50%;
    pointer-events: none;
    animation: glowBreathe 3s ease-in-out infinite alternate;
  }

  /* 3D Orbital Glass Rings */
  .ring {
    position: absolute;
    border-radius: 50%;
    pointer-events: none;
    transform-style: preserve-3d;
  }

  .ring-1 {
    inset: -10px;
    border: 2.5px solid rgba(235, 215, 255, 0.8);
    border-left-color: transparent;
    border-right-color: transparent;
    box-shadow: 0 0 15px rgba(220, 180, 255, 0.4);
    animation: spin3DRing1 3.5s linear infinite;
  }

  .ring-2 {
    inset: -22px;
    border: 2px dashed rgba(183, 142, 255, 0.6);
    box-shadow: 0 0 20px rgba(183, 142, 255, 0.3);
    animation: spin3DRing2 5.5s linear infinite reverse;
  }

  .ring-3 {
    inset: -34px;
    border: 1.5px solid rgba(150, 95, 240, 0.35);
    border-top-color: rgba(255, 255, 255, 0.9);
    animation: spin3DRing3 7.5s ease-in-out infinite;
  }

  /* 3D Floating Step Chips */
  .analysis-steps-container {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    justify-content: center;
    margin-top: 26px;
  }

  .step-chip {
    background: rgba(255, 255, 255, 0.07);
    backdrop-filter: blur(14px);
    border: 1px solid rgba(224, 195, 255, 0.22);
    border-radius: 999px;
    color: #e5dafa;
    font-size: 12.5px;
    font-weight: 600;
    padding: 8px 18px;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.25);
    transition: transform 0.3s ease, border-color 0.3s ease;
    animation: chipFloat3D 4s ease-in-out infinite alternate;
  }
  .step-chip:nth-child(2) { animation-delay: 0.8s; }
  .step-chip:nth-child(3) { animation-delay: 1.6s; }

  .chip-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: #b78eff;
    box-shadow: 0 0 10px #b78eff, 0 0 20px #b78eff;
    animation: dotPulse 1.4s ease-in-out infinite alternate;
  }

  /* 3D Equalizer Wave Bar */
  .analysis-wave-3d {
    display: flex;
    gap: 7px;
    justify-content: center;
    align-items: center;
    margin-top: 28px;
    height: 38px;
  }

  .analysis-wave-3d i {
    width: 6px;
    height: 30px;
    background: linear-gradient(180deg, #f0e6ff 0%, #b78eff 50%, #6432a8 100%);
    border-radius: 999px;
    box-shadow: 0 4px 14px rgba(183, 142, 255, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.8);
    animation: equalizerWave3D 1.1s ease-in-out infinite alternate;
  }

  .analysis-wave-3d i:nth-child(1) { animation-delay: 0.0s; }
  .analysis-wave-3d i:nth-child(2) { animation-delay: 0.15s; }
  .analysis-wave-3d i:nth-child(3) { animation-delay: 0.30s; }
  .analysis-wave-3d i:nth-child(4) { animation-delay: 0.45s; }
  .analysis-wave-3d i:nth-child(5) { animation-delay: 0.60s; }
  .analysis-wave-3d i:nth-child(6) { animation-delay: 0.75s; }
  .analysis-wave-3d i:nth-child(7) { animation-delay: 0.90s; }

  /* 3D KEYFRAME ANIMATIONS */
  @keyframes cardFloat3D {
    0% { transform: translateY(0) rotateX(0deg); }
    100% { transform: translateY(-8px) rotateX(2deg); }
  }

  @keyframes corePulse3D {
    0% { transform: scale(0.95) translateY(0); box-shadow: 0 12px 35px rgba(183, 142, 255, 0.5); }
    100% { transform: scale(1.06) translateY(-4px); box-shadow: 0 22px 50px rgba(200, 160, 255, 0.85); }
  }

  @keyframes sparkleRotate {
    0% { transform: rotate(0deg) scale(1); }
    50% { transform: rotate(180deg) scale(1.15); }
    100% { transform: rotate(360deg) scale(1); }
  }

  @keyframes glowBreathe {
    0% { opacity: 0.5; transform: scale(0.9); }
    100% { opacity: 1; transform: scale(1.15); }
  }

  @keyframes spin3DRing1 {
    0% { transform: rotateX(65deg) rotateY(25deg) rotateZ(0deg); }
    100% { transform: rotateX(65deg) rotateY(25deg) rotateZ(360deg); }
  }

  @keyframes spin3DRing2 {
    0% { transform: rotateX(-50deg) rotateY(55deg) rotateZ(0deg); }
    100% { transform: rotateX(-50deg) rotateY(55deg) rotateZ(360deg); }
  }

  @keyframes spin3DRing3 {
    0% { transform: rotateX(35deg) rotateY(-65deg) rotateZ(0deg); }
    100% { transform: rotateX(35deg) rotateY(-65deg) rotateZ(360deg); }
  }

  @keyframes chipFloat3D {
    0% { transform: translateY(0); }
    100% { transform: translateY(-5px); }
  }

  @keyframes dotPulse {
    0% { opacity: 0.4; transform: scale(0.8); }
    100% { opacity: 1; transform: scale(1.2); }
  }

  @keyframes equalizerWave3D {
    0% { height: 8px; opacity: 0.35; transform: scaleY(0.4); }
    100% { height: 34px; opacity: 1; transform: scaleY(1.1); box-shadow: 0 6px 20px rgba(210, 165, 255, 0.85); }
  }

  .result-heading { align-items: flex-start; display: flex; gap: 20px; justify-content: space-between; margin-bottom: 25px; }
  .result-heading h1 { font-size: clamp(38px,4.7vw,58px); }
  .result-heading h1 + p { color: #675d71; font-size: 15px; line-height: 1.55; max-width: 600px; }
  .outline-dashboard-button { background: rgba(255, 255, 255, 0.4); backdrop-filter: blur(10px); border: 1px solid #4a3657; border-radius: 10px; color: #382743; cursor: pointer; font-size: 12px; font-weight: 700; padding: 12px 18px; white-space: nowrap; transition: all 0.2s ease; box-shadow: 0 4px 15px rgba(0,0,0,0.05); }
  .outline-dashboard-button:hover { background: rgba(255, 255, 255, 0.7); transform: translateY(-1px); }
  
  .evidence-strip { align-items: center; background: rgba(228, 212, 252, 0.85); backdrop-filter: blur(10px); border: 1px solid rgba(255, 255, 255, 0.6); border-radius: 12px; display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 20px; padding: 12px 16px; box-shadow: 0 6px 20px rgba(100, 60, 160, 0.08); }
  .evidence-strip > span { color: #62516f; font: 9px 'DM Mono', monospace; letter-spacing: .6px; text-transform: uppercase; }
  .evidence-strip b, .evidence-strip i { background: #f9f5ff; border-radius: 999px; color: #4b3d57; font-size: 11px; font-style: normal; padding: 6px 10px; }
  .evidence-strip i { background: #261e30; color: #eee7ff; }
  
  .result-grid { display: grid; gap: 18px; grid-template-columns: minmax(0,1.22fr) minmax(250px,.78fr); align-items: start; }
  .conditions-panel, .triage-panel { border-radius: 20px; }
  .conditions-panel { background: rgba(255, 253, 253, 0.9); backdrop-filter: blur(16px); border: 1px solid rgba(255, 255, 255, 0.8); box-shadow: 0 15px 35px rgba(100, 60, 160, 0.1), 8px 8px 0 #d6bcfc; padding: 28px; }
  .panel-title { align-items: flex-start; display: flex; justify-content: space-between; }
  .panel-title p, .triage-panel > p { color: #685678; font: 9px 'DM Mono', monospace; letter-spacing: .8px; margin: 0 0 8px; }
  .panel-title h2, .triage-panel h2, .care-guidance h2, .warning-card h2 { font: 500 26px Fraunces, Georgia, serif; margin: 0; }
  .panel-title > span { background: #e4d4fc; border-radius: 999px; color: #49326d; font: 9px 'DM Mono', monospace; padding: 7px 10px; }
  
  .condition-list { list-style: none; margin: 20px 0 0; padding: 0; }
  .condition-list li { border-top: 1px solid rgba(50,39,65,.12); display: grid; gap: 14px; grid-template-columns: 27px 1fr; padding: 16px 0; }
  .rank { color: #7d55ba; font: 11px 'DM Mono', monospace; padding-top: 4px; }
  .condition-list h3 { font-size: 15px; margin: 0 0 5px; }
  .condition-list p { color: #625a6d; font-size: 13px; line-height: 1.5; margin: 0 0 5px; }
  .condition-list small { color: #8164a4; font-size: 11px; text-transform: capitalize; font-weight: 600; }
  
  .triage-panel { background: linear-gradient(155deg, #1c1426, #120b1a); border: 1.5px solid rgba(220, 190, 255, 0.25); color: #f6efff; padding: 26px 24px; text-align: center; box-shadow: 0 20px 45px rgba(0,0,0,0.5); align-self: flex-start; min-height: 380px; display: flex; flex-direction: column; justify-content: center; }
  .triage-panel > p { color: #c9abff !important; font: 600 11px 'DM Mono', monospace !important; letter-spacing: 1px !important; margin: 0 0 8px !important; }
  .triage-panel h2 { font-size: 36px !important; color: #ffffff !important; letter-spacing: -0.5px !important; margin: 0 0 8px 0 !important; }
  
  /* HIGH CONTRAST & EXACT SPACING FOR TRIAGE REASON & SAFETY NOTE */
  .triage-panel strong { 
    color: #ffffff !important; 
    display: block; 
    font-size: 18px !important; 
    font-weight: 700 !important; 
    line-height: 1.5 !important; 
    margin: 0 0 5px 0 !important; 
    letter-spacing: -0.2px;
    text-shadow: 0 2px 4px rgba(0,0,0,0.3);
  }
  .triage-note { 
    background: rgba(255, 255, 255, 0.07);
    border: 1px solid rgba(255, 255, 255, 0.18);
    border-radius: 14px;
    color: #ede2ff !important; 
    font-size: 14.5px !important; 
    font-weight: 500 !important;
    line-height: 1.6 !important; 
    margin: 0 !important; 
    padding: 14px 16px !important;
    letter-spacing: 0.2px;
    backdrop-filter: blur(10px);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.2);
  }
  /* 3D SMALL STATUS CIRCLES FOR TRIAGE */
  .triage-ring { 
    align-items: center; 
    border-radius: 50%; 
    color: #ffffff; 
    display: flex; 
    font-family: 'DM Sans', sans-serif;
    font-size: 20px; 
    font-weight: 800;
    height: 44px; 
    justify-content: center; 
    margin: 12px auto 10px; 
    width: 44px; 
    transition: transform 0.3s ease, box-shadow 0.3s ease;
  }
  .triage-ring:hover {
    transform: scale(1.1);
  }

  /* 3D Green Circle for MONITOR */
  .triage-monitor .triage-ring { 
    background: radial-gradient(circle at 35% 30%, #4ade80 0%, #16a34a 65%, #14532d 100%);
    border: 2px solid rgba(220, 252, 231, 0.85); 
    color: #ffffff; 
    box-shadow: 0 6px 20px rgba(34, 197, 94, 0.55), inset 0 2px 4px rgba(255, 255, 255, 0.7), inset 0 -2px 4px rgba(0, 0, 0, 0.5); 
  }
  
  /* 3D Yellow/Amber Circle for CONSULT */
  .triage-consult .triage-ring { 
    background: radial-gradient(circle at 35% 30%, #facc15 0%, #ca8a04 65%, #713f12 100%);
    border: 2px solid rgba(254, 240, 138, 0.85); 
    color: #ffffff; 
    box-shadow: 0 6px 20px rgba(234, 179, 8, 0.55), inset 0 2px 4px rgba(255, 255, 255, 0.7), inset 0 -2px 4px rgba(0, 0, 0, 0.5); 
  }

  /* 3D Red Circle for URGENT */
  .triage-urgent .triage-ring { 
    background: radial-gradient(circle at 35% 30%, #f87171 0%, #dc2626 65%, #7f1d1d 100%);
    border: 2px solid rgba(254, 226, 226, 0.85); 
    color: #ffffff; 
    box-shadow: 0 6px 20px rgba(239, 68, 68, 0.6), inset 0 2px 4px rgba(255, 255, 255, 0.7), inset 0 -2px 4px rgba(0, 0, 0, 0.5); 
  }
  
  .care-guidance { align-items: flex-start; background: linear-gradient(135deg, rgba(225, 205, 255, 0.94) 0%, rgba(202, 172, 252, 0.88) 100%); backdrop-filter: blur(25px); -webkit-backdrop-filter: blur(25px); border: 1.5px solid rgba(255, 255, 255, 0.85); border-radius: 24px; color: #1a0f26; display: grid; gap: 32px; grid-template-columns: 0.9fr 1.1fr; margin-top: 22px; padding: 36px; box-shadow: 0 20px 45px -10px rgba(100, 60, 170, 0.2), inset 0 1px 2px rgba(255, 255, 255, 0.95), inset 0 -1px 2px rgba(100, 60, 170, 0.1); transition: transform 0.3s ease, box-shadow 0.3s ease; }
  .care-guidance:hover { transform: translateY(-2px); box-shadow: 0 28px 55px -12px rgba(100, 60, 170, 0.28), inset 0 1px 3px rgba(255, 255, 255, 1); }
  .care-guidance .dashboard-eyebrow { color: #552d8a !important; font: 700 11.5px 'DM Mono', monospace !important; letter-spacing: 1.2px !important; margin-bottom: 10px !important; }
  .care-guidance h2 { font: 600 30px Fraunces, Georgia, serif !important; color: #170924 !important; line-height: 1.25 !important; margin-bottom: 12px !important; letter-spacing: -0.5px; }
  .care-guidance p:not(.dashboard-eyebrow) { color: #38254b !important; font-size: 15px !important; font-weight: 500 !important; line-height: 1.65 !important; margin: 0 !important; }
  
  .care-columns { display: grid; gap: 20px; grid-template-columns: 1fr 1fr; }
  .care-columns > div { background: rgba(255, 255, 255, 0.38); backdrop-filter: blur(12px); border: 1px solid rgba(255, 255, 255, 0.65); border-radius: 18px; padding: 22px; box-shadow: 0 6px 20px rgba(100, 60, 160, 0.07); }
  .care-columns h3 { color: #180a26 !important; font-size: 17.5px !important; font-weight: 700 !important; margin: 0 0 12px 0 !important; letter-spacing: -0.2px; }
  .care-columns ul { color: #271738 !important; font-size: 14.5px !important; font-weight: 500 !important; line-height: 1.65 !important; margin: 0 !important; padding-left: 18px !important; }
  .care-columns li { margin-bottom: 10px; }
  .care-columns li:last-child { margin-bottom: 0; }
  .care-columns li strong { color: #170726 !important; font-weight: 700 !important; }
  
  .warning-card { background: linear-gradient(135deg, rgba(255, 240, 243, 0.95), rgba(255, 225, 232, 0.9)); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); border: 1.5px solid rgba(255, 255, 255, 0.85); border-radius: 20px; margin-top: 22px; padding: 28px; box-shadow: 0 15px 35px rgba(220, 100, 130, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.9); }
  .warning-card h2 { color: #5c1830 !important; font-size: 24px !important; font-weight: 700 !important; margin-bottom: 12px !important; }
  .warning-card ul { color: #4a1528 !important; font-size: 14.5px !important; font-weight: 500 !important; line-height: 1.65 !important; margin: 0 !important; padding-left: 20px !important; }
  
  .result-bottom { align-items: center; background: linear-gradient(135deg, #211a29, #14101b); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 16px; display: flex; justify-content: space-between; margin-top: 24px; padding: 18px 24px; box-shadow: 0 10px 30px rgba(0,0,0,0.3); }
  .result-bottom p { color: #d5c9e2; font-size: 12px; margin: 0; }
  .result-bottom button { background: none; border: 0; color: #d7baff; cursor: pointer; font-size: 13px; font-weight: 700; transition: transform 0.2s ease; }
  .result-bottom button:hover { transform: translateX(3px); }

  .history-backdrop { background: rgba(8, 5, 12, 0.65); backdrop-filter: blur(8px); inset: 0; position: fixed; z-index: 30; }
  .history-panel { background: rgba(255, 253, 253, 0.95); backdrop-filter: blur(25px); border-left: 1px solid rgba(255, 255, 255, 0.8); box-shadow: -20px 0 50px rgba(0,0,0,0.35); color: #2b2235; height: 100%; overflow-y: auto; padding: 32px; position: absolute; right: 0; top: 0; width: min(480px,100vw); }
  .history-heading { align-items: flex-start; display: flex; justify-content: space-between; }
  .history-heading h2 { font: 500 31px Fraunces, Georgia, serif; margin: 0; }
  .history-heading button { background: none; border: 0; color: #554664; cursor: pointer; font-size: 28px; line-height: 1; transition: transform 0.2s ease; }
  .history-heading button:hover { transform: scale(1.15); }
  .history-empty { color: #736879; font-size: 14px; margin-top: 35px; }
  .history-list { list-style: none; margin: 25px 0; padding: 0; }
  .history-list li { border-top: 1px solid #e5ddea; }
  .history-list button { background: none; border: 0; color: inherit; cursor: pointer; display: block; padding: 16px 0; text-align: left; width: 100%; transition: opacity 0.2s ease; }
  .history-list button:hover:not(:disabled) { opacity: 0.75; }
  .history-list button:disabled { cursor: default; opacity: .55; }
  .history-list span { color: #7c6c8d; display: block; font: 10px 'DM Mono', monospace; margin-bottom: 5px; }
  .history-list strong { font-size: 14px; }
  .history-list p { color: #685d70; display: -webkit-box; font-size: 12.5px; line-height: 1.45; margin: 5px 0 0; overflow: hidden; -webkit-box-orient: vertical; -webkit-line-clamp: 2; }
  
  @media (max-width: 760px) { 
    .dashboard-header { height: 65px; padding: 0 14px; }
    .dashboard-brand { font-size: 18px; }
    .history-button { display: none; }
    .dashboard-main { padding: 13px 10px 30px; }
    .dashboard-content { border-radius: 20px; min-height: calc(100vh - 91px); padding: 27px 16px; }
    .input-layout, .result-grid, .care-guidance, .timeline-card { grid-template-columns: 1fr; }
    .pet-profile-card { grid-row: auto; }
    .image-card { grid-template-columns: 1fr; }
    .result-heading, .assessment-footer, .result-bottom { align-items: flex-start; flex-direction: column; }
    .assessment-footer { gap: 16px; }
    .assessment-button { justify-content: center; width: 100%; }
    .care-columns { grid-template-columns: 1fr; }
    .timeline-input { margin-top: 2px; }
    .result-heading h1, .assessment-intake > h1 { font-size: 40px; }
    .outline-dashboard-button { width: 100%; }
    .account-avatar { height: 34px; width: 34px; } 
    .result-heading-actions { align-items: stretch; width: 100%; margin-top: 16px; }
  }

  .result-heading-actions {
    display: flex;
    flex-direction: column;
    gap: 12px;
    align-items: stretch;
    min-width: 195px;
  }
  .contact-vet-btn {
    background: linear-gradient(135deg, rgba(147, 86, 220, 0.15), rgba(100, 60, 180, 0.25)) !important;
    border-color: rgba(175, 125, 245, 0.4) !important;
    color: #2b1f3d !important;
    font-weight: 600;
  }
  .contact-vet-btn:hover {
    background: linear-gradient(135deg, rgba(147, 86, 220, 0.3), rgba(100, 60, 180, 0.4)) !important;
    border-color: rgba(195, 150, 255, 0.6) !important;
    transform: translateY(-2px);
  }

  .vet-modal-backdrop {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
    z-index: 50;
  }
  .vet-modal-card {
    background: rgba(255, 253, 253, 0.96);
    backdrop-filter: blur(30px);
    -webkit-backdrop-filter: blur(30px);
    border: 1px solid rgba(255, 255, 255, 0.9);
    border-radius: 24px;
    box-shadow: 0 25px 60px rgba(15, 10, 25, 0.4), 0 0 0 1px rgba(220, 200, 255, 0.3);
    color: #2b2235;
    max-width: 440px;
    padding: 36px 32px 40px;
    position: relative;
    text-align: center;
    width: 100%;
    animation: vetModalPop 0.25s cubic-bezier(0.16, 1, 0.3, 1);
  }
  @keyframes vetModalPop {
    from { opacity: 0; transform: scale(0.92) translateY(10px); }
    to { opacity: 1; transform: scale(1) translateY(0); }
  }
  .vet-modal-close {
    background: rgba(0, 0, 0, 0.05);
    border: 0;
    border-radius: 50%;
    color: #554664;
    cursor: pointer;
    font-size: 24px;
    height: 36px;
    line-height: 1;
    position: absolute;
    right: 18px;
    top: 18px;
    transition: all 0.2s ease;
    width: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .vet-modal-close:hover {
    background: rgba(0, 0, 0, 0.1);
    transform: scale(1.1);
  }
  .vet-modal-body {
    display: flex;
    flex-direction: column;
    align-items: center;
  }
  .vet-img-wrapper {
    background: linear-gradient(135deg, #eaddff 0%, #d0bfff 100%);
    border-radius: 50%;
    box-shadow: 0 12px 30px rgba(138, 75, 220, 0.25);
    height: 130px;
    margin: 0 auto 20px;
    overflow: hidden;
    padding: 8px;
    width: 130px;
  }
  .vet-doctor-img {
    border-radius: 50%;
    height: 100%;
    object-fit: cover;
    width: 100%;
  }
  .vet-modal-body h2 {
    color: #1e152a;
    font: 600 24px 'Fraunces', Georgia, serif;
    letter-spacing: -0.5px;
    margin: 0 0 10px;
  }
  .vet-modal-message {
    background: rgba(147, 86, 220, 0.08);
    border: 1px solid rgba(147, 86, 220, 0.18);
    border-radius: 12px;
    color: #634f77;
    font-size: 15px;
    font-weight: 500;
    line-height: 1.5;
    margin: 8px 0 0;
    padding: 12px 20px;
  }
`;

