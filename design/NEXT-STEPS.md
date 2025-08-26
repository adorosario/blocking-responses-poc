Read this first: it will show you WHY I am doing this project

https://docs.google.com/document/d/1ilBC9sc48S8kutO4Mv_qly0COZMFFen_lnHJaLr8IlI/edit?tab=t.0

and then read this: which will tell you HOW we are approaching it:

https://docs.google.com/document/d/1JrZOw-eLycqUYwfDSX57C7wj5UWvg7f0tB687EYzUyQ/edit?tab=t.0

It Basically Acts as a security layer between AI language models (like GPT) and end users, preventing sensitive or regulated information from being exposed in AI responses.

Target Industries & Compliance:
- 🏥 Healthcare (HIPAA) - Prevents PHI (Protected Health Information) exposure
- 💳 Financial (PCI DSS) - Blocks credit card, banking, payment data
- 🌍 Privacy (GDPR/CCPA) - Filters personally identifiable information (PII)
- 🔒 General Security - Prevents passwords, API keys, SSNs, etc.

This is essentially a "smart firewall for AI responses" that makes it safe for hospitals, banks, law firms, and other regulated organizations to use AI systems without accidentally exposing sensitive customer, patient, or financial data. 

REQUIREMENT 1: See how we are buffering the response in realtime, validating it, and then allowing it to pass or block.

REQUIREMENT 2: See how we are checking the response in realtime using heuristic rules + LLM-As-Judge.

My goal for this app is to PROVE to my engineers the REQUIREMENT 1 and REQUIREMENT 2 above .. and when I say PROVE, I mean real PROOF .. the goal of this app (and your goal) is to show the live stream of what is happening including:

1. What set of tokens in the response is being analyzed.
2. What and how was the decision made?
3. Was it passed back to browser (or blocked?)

