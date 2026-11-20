// 둘러보기 탭의 여행 전·중·후 도움 카드. 카드를 누르면 prompt가 그대로 AI 채팅의 첫 질문이 된다.
// 홈의 보조 칩(PR B)도 같은 카드를 id로 다시 쓴다
export type ExploreStage = "before" | "during" | "after";

export type HelpCard = { id: string; emoji: string; title: string; desc: string; prompt: string };

export const EXPLORE_STAGES: { id: ExploreStage; label: string; cards: HelpCard[] }[] = [
  {
    id: "before",
    label: "여행 전 준비",
    cards: [
      {
        id: "outfit",
        emoji: "🧥",
        title: "기온별 옷차림 & 준비물",
        desc: "반팔·긴팔·경량패딩 중 무엇을 챙길지",
        prompt: "여행 갈 곳의 기온에 맞춰 옷차림(반팔·긴팔·경량패딩)과 꼭 챙길 준비물을 알려 줘",
      },
      {
        id: "pass",
        emoji: "🎟",
        title: "교통패스 손익 계산",
        desc: "패스를 사는 게 이득인지 따져 보기",
        prompt: "여행 중에 교통패스를 사는 게 이득인지 따져 보는 방법을 알려 줘",
      },
      {
        id: "entry",
        emoji: "🛂",
        title: "출국 전 체크리스트",
        desc: "여권 유효기간·입국 서류·환전·유심",
        prompt: "해외여행 출국 전에 확인할 체크리스트(여권 유효기간, 입국 서류, 환전, 유심·eSIM)를 알려 줘",
      },
    ],
  },
  {
    id: "during",
    label: "여행 중 해결 ⚡",
    cards: [
      {
        id: "sos",
        emoji: "🚨",
        title: "비상시 대처 순서 & 대사관 SOS",
        desc: "여권 분실·아플 때·사고가 났을 때",
        prompt: "해외여행 중 여권을 잃어버리거나 아프거나 사고가 났을 때 대처 순서와 대사관·영사콜센터 연락 방법을 알려 줘",
      },
      {
        id: "money",
        emoji: "💱",
        title: "환율·결제 도움말",
        desc: "현금과 카드 중 무엇이 나은지",
        prompt: "여행 중 현지 결제는 현금과 카드 중 무엇이 나은지, 환전 수수료를 줄이는 방법을 알려 줘",
      },
      {
        id: "checkin",
        emoji: "🛎",
        title: "체크인 도움말",
        desc: "늦은 도착·짐 맡기기·숙박세",
        prompt: "숙소 체크인할 때 늦게 도착하는 경우, 짐 맡기기, 현장에서 내는 숙박세에 대해 알려 줘",
      },
    ],
  },
  {
    id: "after",
    label: "여행 후 정리",
    cards: [
      {
        id: "refund",
        emoji: "📉",
        title: "무료 취소 가격 하락 점검",
        desc: "더 싸졌다면 다시 예약해도 될까",
        prompt: "무료 취소로 예약한 숙소가 더 싸졌을 때 취소하고 다시 예약해도 되는지 점검하는 순서를 알려 줘",
      },
      {
        id: "tax",
        emoji: "🧾",
        title: "택스 리펀·영수증 정리",
        desc: "면세 환급과 카드 해외 결제 확인",
        prompt: "여행 후 택스 리펀(면세 환급)과 카드 해외 결제 내역을 정리하는 방법을 알려 줘",
      },
    ],
  },
];

