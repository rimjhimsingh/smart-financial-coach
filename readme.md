# Smart Financial Coach

## Project Overview

**Smart Financial Coach** is a full stack financial intelligence prototype that transforms raw transaction data into clear, actionable insights. The application helps users understand spending behavior, identify recurring charges and hidden waste, surface unusual transactions, and receive contextual explanations through an AI powered copilot.

The system is built with a **React** frontend and a **Flask** backend. Transaction data from multiple financial sources (Amex, SoFi, Chase) is normalized into a unified in-memory data store and analyzed in real time using a custom analytics engine. Core insights are deterministic and explainable, while AI is selectively applied for summarization, insight generation, and conversational assistance.

### Key capabilities
- Unified executive dashboard showing spend, cashflow, and category trends
- Subscription and gray charge detection with annualized cost estimation
- Rule-based anomaly detection with clear, human-readable explanations
- Context-aware AI Copilot with strict JSON contracts, caching, and fallback behavior
- Privacy-conscious architecture using in-memory processing only

### Design and engineering highlights
- Clear separation of concerns between frontend, API routes, analytics services, and AI integration
- Modular backend design using Flask Blueprints and the application factory pattern
- Analytics implemented with pandas for fast, explainable transformations
- Responsible AI usage with grounding, rate-limit handling, and deterministic fallbacks

### Technical stack
- **Frontend**: React, JavaScript, Parcel, Tailwind CSS, Recharts
- **Backend**: Python, Flask, pandas
- **AI**: Gemini (via google-genai client)
- **Architecture**: In-memory data store, REST APIs, service-oriented backend

### Future enhancements
- Secure bank account connectivity using Plaid or similar providers
- Persistent storage and multi-user support
- More advanced anomaly detection and forecasting models
- Enhanced AI grounding, evaluation, and observability
- Production-grade security, authentication, and monitoring

For detailed design decisions, system architecture, analytics algorithms, AI considerations, and future roadmap, please refer to the **Project Design Documentation (PDF)** included with this submission.

---

## Video Submissions

- **YouTube Demo Video**  
  https://youtu.be/FMw6KohO_78

- **Google Drive Demo Video**  
  https://drive.google.com/file/d/138fV0QVotNX8acObLOpsg_XtT42XrNIo/view?usp=sharing
