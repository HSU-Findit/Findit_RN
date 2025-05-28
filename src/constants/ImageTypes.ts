import { MaterialIcons } from '@expo/vector-icons';

// 이미지 유형 정의
export type ImageType = 'CONTRACT' | 'PAYMENT' | 'DOCUMENT' | 'PRODUCT' | 'OTHER';

// 이미지 유형별 프롬프트 템플릿
export const IMAGE_TYPE_PROMPTS: Record<ImageType, string> = {
  CONTRACT: `당신은 계약서 분석 전문가입니다. 다음 정보를 반드시 창의적으로 포함하여 분석해주세요:

1. 계약서 핵심 정보:
   - 계약 당사자 (양측)
   - 계약 기간 (시작일/종료일)
   - 주요 계약 조건
   - 특이사항

2. 계약서 분석:
   - 계약의 주요 목적
   - 중요한 조항
   - 잠재적 위험 요소
   - 주의해야 할 점

3. 권장 사항:
   - 검토가 필요한 부분
   - 보완이 필요한 사항
   - 추가 확인이 필요한 내용`,

  PAYMENT: `당신은 정산/지출 문서 분석 전문가입니다. 다음 정보를 반드시 창의적으로 포함하여 분석해주세요:

1. 거래 정보:
   - 거래 항목 및 수량
   - 총 금액 및 세부 금액
   - 거래 일시
   - 거래 장소/지점명

2. 거래 분석:
   - 거래 유형 (현금/카드/계좌이체)
   - 세금 관련 정보
   - 할인/적립 정보
   - 거래 상태

3. 중요 체크포인트:
   - 금액 정확성
   - 거래 일자 확인
   - 영수증 유효성
   - 보관 필요 여부`,

  DOCUMENT: `당신은 문서/논문 분석 전문가입니다. 다음 정보를 반드시 포함하여 창의적으로 분석해주세요:

1. 문서 기본 정보:
   - 문서 제목
   - 작성자/기관
   - 작성일
   - 문서 유형

2. 내용 분석:
   - 주요 내용 요약
   - 핵심 주장/결론
   - 중요 인용구
   - 참고 문헌

3. 문서 평가:
   - 신뢰성
   - 시의성
   - 활용 가치
   - 추가 조사 필요 사항`,

  PRODUCT: `당신은 음식 제품 설명서 분석 전문가입니다. 다음 정보와 무슨 맛인지 포함하고 창의적으로 분석해주세요:

1. 기본 영양 정보:
   - 제품명
   - 1회 제공량
   - 총 제공량
   - 열량 (kcal)

2. 주요 영양소:
   - 탄수화물 (g)
   - 단백질 (g)
   - 지방 (g)
   - 나트륨 (mg)
   - 당류 (g)
   - 식이섬유 (g)

3. 영양 분석:
   - 일일 영양소 기준치 대비 비율
   - 주의해야 할 영양소
   - 건강 관련 특이사항
   - 알레르기 유발 물질`,

  OTHER: `당신은 이미지 분석 전문가입니다. 다음 정보를 반드시 포함하여 분석해주세요:

1. 기본 정보:
   - 이미지 유형
   - 주요 내용
   - 중요 정보

2. 상세 분석:
   - 핵심 메시지
   - 주요 특징
   - 특이사항

3. 활용 방안:
   - 주요 용도
   - 활용 가능성
   - 추가 조사 필요 사항`
};

// 이미지 유형별 키워드 (자동 감지용)
export const IMAGE_TYPE_KEYWORDS: Record<ImageType, string[]> = {
  CONTRACT: ['계약서', '계약', '계약기간', '당사자', '서명', '계약조건'],
  PAYMENT: ['영수증', '거래명세서', '결제', '금액', '지출', '수입', '정산', '지급', '수령', '지점', '매장'],
  DOCUMENT: ['논문', '문서', '보고서', '작성자', '작성일', '결론', '요약'],
  PRODUCT: ['영양성분', '영양정보', '영양성분표', '열량', '칼로리', '단백질', '지방', '나트륨', '당류', '1회 제공량'],
  OTHER: []
};

// 이미지 유형별 아이콘 이름 (MaterialIcons)
export const IMAGE_TYPE_ICONS: Record<ImageType, keyof typeof MaterialIcons.glyphMap> = {
  CONTRACT: 'description',
  PAYMENT: 'receipt-long',
  DOCUMENT: 'article',
  PRODUCT: 'inventory-2',
  OTHER: 'help-outline'
};

// 이미지 유형별 이름 (한국어)
export const IMAGE_TYPE_NAMES: Record<ImageType, string> = {
  CONTRACT: '계약서',
  PAYMENT: '정산/지출',
  DOCUMENT: '논문/문서',
  PRODUCT: '설명서',
  OTHER: '기타'
};

// 이미지 유형별 색상
export const IMAGE_TYPE_COLORS: Record<ImageType, string> = {
  CONTRACT: '#4CAF50',  // 녹색
  PAYMENT: '#2196F3',   // 파란색
  DOCUMENT: '#FF9800',  // 주황색
  PRODUCT: '#9C27B0',   // 보라색
  OTHER: '#757575'      // 회색
}; 