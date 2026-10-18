export const policyGuidance = [
  {
    id: "privacy-school-data",
    number: "01",
    title: "Privacy & school data",
    tag: "PRIVACY",
    description: "School records can include personal information. Access should be limited to people who need it for their school role.",
    points: [
      "Use your own account, keep sign-in details private, and sign out on shared devices.",
      "Only view or share information you are authorized to access. Check recipients before sending school records.",
      "Recently opened authenticated pages may be saved on this device for read-only offline viewing for up to 24 hours. These snapshots may contain private school information.",
      "Offline snapshots are cleared on sign-out or when the account or selected-school scope changes. Avoid using offline viewing on a shared or untrusted device.",
      "Ask your school administrator about its approved process for data access, correction, retention, or deletion requests.",
    ],
  },
  {
    id: "acceptable-use",
    number: "02",
    title: "Acceptable use",
    tag: "PLATFORM USE",
    description: "Use Schooliva responsibly and in line with your school’s rules and the access assigned to your account.",
    points: [
      "Keep your account credentials private; do not let another person use your account.",
      "Do not attempt to bypass permissions, access another school’s information, or disrupt the service.",
      "Enter accurate information and use the platform only for legitimate school-related work.",
      "Do not upload or include sensitive information unless it is necessary and you are authorized to handle it.",
      "Report suspected account misuse or a security concern to your school administrator and through the support center.",
    ],
  },
  {
    id: "support-service",
    number: "03",
    title: "Support & service",
    tag: "SERVICE",
    description: "The support center helps school leaders report platform issues, ask questions, and suggest improvements.",
    points: [
      "School administrators and principals can submit and follow requests in the Support Center.",
      "Choose the closest request category, describe what happened, and include steps to reproduce technical issues.",
      "The Master Admin team can update a request’s status and add a response; check your request history for updates.",
      "Do not include passwords, payment-card details, or unnecessary student or health information in a request or email.",
      "No service hours or response-time commitment has been approved for this draft. For an urgent school matter, use your school’s established contact and escalation channels.",
    ],
  },
  {
    id: "safeguarding-reporting",
    number: "04",
    title: "Safeguarding & reporting",
    tag: "SAFEGUARDING",
    description: "The Schooliva support inbox is not an emergency service or a replacement for your school’s safeguarding process.",
    points: [
      "If someone is in immediate danger, contact local emergency services and your school’s designated safeguarding lead now.",
      "For a safeguarding concern, follow your school’s approved reporting process and contact the responsible safeguarding person directly.",
      "Do not rely on a platform support request or email to receive immediate attention.",
      "Share only the minimum information needed, using your school’s approved secure channel. Avoid putting identifiable student details in a general support ticket.",
      "Follow your school’s procedures for recording, escalating, and protecting reports. This draft does not replace local policy or legal requirements.",
    ],
  },
] as const;

export const frequentlyAskedQuestions = [
  {
    question: "Who can use the school Support Center?",
    answer: "School administrators and principals can submit requests and review request history for their school. Platform administrators can review requests in the Master Admin inbox.",
  },
  {
    question: "What can I ask support about?",
    answer: "You can report a platform issue, make a feature request, submit a complaint, or ask a policy, account-access, or billing question. Choose the closest category and explain what help you need.",
  },
  {
    question: "How do I follow up on a request?",
    answer: "Open Support Center to see your request history, current status, and any response from the platform team. Email updates depend on the support email service being configured.",
  },
  {
    question: "How quickly will I get a response?",
    answer: "A response-time commitment has not been approved for these draft policies. If the matter is urgent, use your school's established contact or escalation process instead of waiting for a ticket reply.",
  },
  {
    question: "Can I use Schooliva offline?",
    answer: "Recently opened authenticated pages may be available as read-only snapshots on the same device for up to 24 hours. Changes and form submissions still require an internet connection.",
  },
  {
    question: "Who should I contact about student-data access or correction?",
    answer: "Start with your school administrator, who can direct you to the school's approved process. Do not send sensitive student information through a general support request unless your school has authorized that channel.",
  },
  {
    question: "What should I do about an urgent safeguarding concern?",
    answer: "Contact local emergency services if anyone is in immediate danger, and contact your school's designated safeguarding lead using the established reporting process. Do not rely on a platform ticket or email for urgent response.",
  },
];

export type PolicyGuidance = (typeof policyGuidance)[number];

export function getPolicyById(id: string) {
  return policyGuidance.find((policy) => policy.id === id);
}
