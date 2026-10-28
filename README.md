## 💡 1. Idea
When our pets feel unwell, they cannot tell us where it hurts. Pet parents often oscillate between extreme panic and dangerous delay. 
**PetCare AI** is an intelligent, compassionate health assistant designed to act as the first line of guidance. 
Instead of deciphering vague internet search results, pet parents can speak naturally or upload photos of their pet's symptoms.
PetCare AI instantly synthesizes multimodal observations into clear triage tiers, offers safe home care insights, and compiles structured, clinical-grade summaries ready for veterinarians.
---

## 🚨 2. Problems
* **The "Dr. Google" Panic:** Searching pet symptoms online often shows extreme, worst-case scenarios, sparking panic or promoting unreliable home remedies.
* **Silent Suffering & Delayed Action:** Animals instinctively mask symptoms. Owners often can't gauge whether a subtle change is an urgent emergency or safe to monitor.
* **Communication Gaps During Vet Visits:** In stressful appointments, pet parents forget critical onset times, behavioral changes, or earlier visual symptoms, costing valuable clinical time.
* **Limitations of Text-Only Inputs:** Medical conditions in pets are inherently visual and physical. Describing skin irritations, gait changes, or strange sounds solely through text is frustrating and imprecise.
---

## 🛠️ 3. Solutions
* **Multimodal Intake (Voice, Photo & Text):** Speak naturally with voice recordings, snap photos of visible conditions (lesions, swelling, eye discharge), or type simple observations without medical terminology.
* **Intelligent Clinical Triage:** Instantly classifies symptoms into three actionable categories:
  * 🔴 **URGENT:** Immediate emergency clinic intervention needed.
  * 🟡 **CONSULT:** Non-emergency scheduled vet visit recommended.
  * 🟢 **MONITOR:** Safe for home observation with specific watchpoints.
* **Evidence-Based Differential Insights:** Delivers transparent, non-alarmist probable causes paired with safe at-home monitoring checklists.
* **Vet-Ready Clinical Summaries:** Automatically generates exportable, chronological medical briefs with attached images and symptom timelines to hand directly to veterinarians.
* **Persistent Health Timeline:** Authenticated profiles safely log assessments over time, allowing owners to track recurring issues and treatment responses.
---

## 💻 4. Tech Stack
| Layer | Technologies |
| :--- | :--- |
| **Frontend** | React, Vite, Modern CSS, Responsive Design |
| **Backend** | Node.js, Express.js, Multer (In-Memory Buffer Streaming) |
| **AI / ML** | OpenAI Whisper (Speech-to-Text), OpenAI / OpenRouter Multimodal Vision & LLMs, XGBoost, Scikit-learn (PetEval classification pipeline) |
| **Data & Auth** | Supabase (PostgreSQL Database, JWT Auth, Protected Storage Buckets) |
| **Data Science & Processing** | Python, Pandas, NumPy, Jupyter / Google Colab |
| **Deployment** | Vercel (Frontend & Serverless Integration) |
---
*Built with ❤️ for pets and the people who love them.*



▶️ Demo Video: https://www.youtube.com/watch?v=Xz2614vvBaI&t=3s

### 👤 Author
- **Supriyo Halder** - GitHub: [@Legendx143](https://github.com/Legendx143)
- Built for **CodeStorm 2026: FutureForge**
