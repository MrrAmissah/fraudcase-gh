import { FraudCase } from "../../types/fraudCase";

export const MOCK_CASES: FraudCase[] = [
  {
    id: "case-001",
    title: "Fake Ghana Post Courier Delivery SMS",
    description: "Received an SMS from a sender named 'GH-POST' claiming a package cannot be delivered due to an incorrect address, directing to an external link to pay a small re-delivery clearance fee.",
    status: "analyzed",
    incidentDate: "2026-06-18",
    createdAt: "2026-06-18T14:30:00Z",
    updatedAt: "2026-06-18T15:00:23Z",
    evidenceItems: [
      {
        id: "ev-101",
        caseId: "case-001",
        type: "sms",
        title: "Initial Delivery Fee Request SMS",
        originalText: "GH-POST: Your parcel with tracking GH-827-0198 has arrived at our sorting hub. However, we cannot complete delivery due to an incomplete street address. Please update your details and pay a small clearance fee of GHS 12.50 to release it: https://ghana-post-clearance.cz/pay-fee. Contact support at 0240000000.",
        createdAt: "2026-06-18T14:32:00Z"
      },
      {
        id: "ev-102",
        caseId: "case-001",
        type: "url",
        title: "Phishing Payment Page Link",
        originalText: "https://ghana-post-clearance.cz/pay-fee",
        createdAt: "2026-06-18T14:35:00Z"
      }
    ],
    analysis: {
      scamCategory: "fake_delivery",
      confidence: "high",
      riskScore: 88,
      shortSummary: "Fictional case matching common courier brand impersonation patterns in Ghana, requesting small upfront online payments via unrecognized domains to steal credit card details or Mobile Money wallet inputs.",
      suspiciousIndicators: [
        "Impersonation of a reputable state organization (Ghana Post / GH-POST) using a regular SMS masking ID.",
        "Request for an urgent, unexpected, small clearance payment (GHS 12.50) to facilitate a delivery.",
        "The web link uses a foreign Czech Republic domain suffix (.cz) which has absolutely no operational relationship with Ghana Post.",
        "Low clearance fee is a cognitive anchor designed to make the victim pay without thinking, hiding a credential-stealing form behind it."
      ],
      extractedEntities: {
        phoneNumbers: ["0240000000"],
        urls: ["https://ghana-post-clearance.cz/pay-fee"],
        names: [],
        organizations: ["GH-POST", "Ghana Post"],
        amounts: ["GHS 12.50"],
        dates: ["2026-06-18"],
        transactionReferences: ["GH-827-0198"],
        locations: ["Sorting Hub"]
      },
      timeline: [
        {
          date: "2026-06-18T14:30:00Z",
          event: "Victim received an unsolicited SMS titled 'GH-POST' claiming delivery issues.",
          source: "Initial Delivery Fee Request SMS"
        },
        {
          date: "2026-06-18T14:35:00Z",
          event: "Victim clicked open the link and noted a payment gateway requesting credit card or MoMo pin entry.",
          source: "Phishing Payment Page Link"
        }
      ],
      evidenceChecklist: [
        {
          item: "original SMS/message captured",
          status: "present",
          note: "Original SMS text item is captured inside the Case Evidence Vault."
        },
        {
          item: "sender ID or phone number captured",
          status: "present",
          note: "SMS Sender masking ID 'GH-POST' and contact phone '0240000000' registered."
        },
        {
          item: "destination URL captured",
          status: "present",
          note: "Direct unverified url link 'https://ghana-post-clearance.cz/pay-fee' extracted."
        },
        {
          item: "payment receipt added if payment occurred",
          status: "unclear",
          note: "No direct financial transaction receipt was uploaded. Confirm if payment occurred."
        },
        {
          item: "transaction reference added if payment occurred",
          status: "unclear",
          note: "No transaction ref specified. Add receipt if any wallet transfers occurred to enable tracking."
        },
        {
          item: "screenshot evidence added",
          status: "missing",
          note: "Screenshot evidence is currently missing. Please snap high-resolution screen-grabs."
        },
        {
          item: "user notes added",
          status: "present",
          note: "Clean synopsis and incident description are provided by the case initiator."
        }
      ],
      recommendedNextSteps: [
        "Do NOT supply details on this phishing website. If credit card or wallet PIN details were entered, contact your bank or Mobile Money operator (MTN MoMo, Telecel Cash, AT Money) immediately to block card/wallet access or change your PIN.",
        "Report the malicious URL 'https://ghana-post-clearance.cz/pay-fee' to the National Cybersecurity Authority (NCA) of Ghana via standard channels (SMS 292 or call text).",
        "Block the underlying phone number (0240000000) on your device to stop subsequent contact.",
        "Take a physical screenshot of the original SMS containing the sender ID and timestamp for official police records."
      ],
      reportSummary: "This structured dossier gathers proof of automated delivery-impersonating smishing in southern Ghana. It compiles SMS copy, phishing vectors, and diagnostic pointers to present directly to cybersecurity specialists or financial dispute team officers.",
      disclaimer: "Disclaimer: This report was prepared by FraudCase GH for evidence structuring purposes. It suggests potential indicators of suspicious activity based on common patterns but does not represent a law-enforcement ruling or official legal outcome."
    }
  },
  {
    id: "case-002",
    title: "Suspicious Remote Freelance Recruiter Whatsapp",
    description: "An unsolicited Whatsapp message claiming to represent an international marketing agency offering a high-paying part-time remote job (liking YouTube videos) but requiring an initial registration deposit in Tether (USDT).",
    status: "draft",
    incidentDate: "2026-06-15",
    createdAt: "2026-06-15T09:12:00Z",
    updatedAt: "2026-06-15T09:12:00Z",
    evidenceItems: [
      {
        id: "ev-201",
        caseId: "case-002",
        type: "whatsapp",
        title: "Recruitment Outreach Message",
        originalText: "Hello! I am Sarah from apex-digital media. We found your contact profile. We offer an online part-time job for Ghanaian freelancers. You only need to like 3 videos a day to make GHS 450 daily. We pay via mobile money or cryptocurrency. Direct message us here to start immediately. A deposit of GHS 100 is needed to activate your worker dashboard account: http://apex-likes-gh.icu/welcome.",
        createdAt: "2026-06-15T09:12:00Z"
      }
    ]
  }
];
