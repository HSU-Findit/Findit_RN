import { OPENAI_API_KEY } from '@env';
import OpenAI from 'openai';
import { IMAGE_TYPE_PROMPTS, ImageType } from '../constants/ImageTypes';

if (!OPENAI_API_KEY) {
  throw new Error('OpenAI API key is not set. Please check your .env file.');
}

// OpenAI 모델 설정
// 발표회 당일: 'gpt-4'로 변경
// 개발/테스트: 'gpt-3.5-turbo' 사용
const OPENAI_MODEL = 'gpt-3.5-turbo';

const openai = new OpenAI({
  apiKey: OPENAI_API_KEY,
});

/**
 * OpenAI API를 사용하여 주어진 텍스트를 요약합니다.
 * @param text 요약할 텍스트입니다.
 * @returns 요약된 텍스트 또는 오류 메시지를 반환하는 Promise 객체입니다.
 */
export const getInfoFromTextWithOpenAI = async (text: string | null, imageType: ImageType = 'OTHER'): Promise<string> => {
  if (!text) {
    return '정보를 추출할 텍스트가 제공되지 않았습니다.';
  }
  try {
    // 이미지 유형별 프롬프트 가져오기
    const typeSpecificPrompt = IMAGE_TYPE_PROMPTS[imageType];

    const completion = await openai.chat.completions.create({
      model: OPENAI_MODEL,
      messages: [
        { 
          role: 'system', 
          content: `당신은 이미지 분석 및 Q&A 어시스턴트입니다. 모든 응답은 마크다운 형식으로 작성하며, 간결하고 명확하게 정보를 전달하세요.

          ${typeSpecificPrompt}
응답 형식:
1. **주요 정보 요약** (2-3문장)
2. **핵심 분석** (불릿 포인트로 간단히)
3. **추가 정보** (필요한 경우에만)
4. **이미지 타입에 맞는 정보** 
예시 1 (질문 포함):
분석 결과: "[텍스트 분석 결과] 회의록: 프로젝트 X 진행 상황 보고
[감지된 물체] - 노트북 - 사람 - 책상
[이미지 라벨] - 회의 - 사무실 - 비즈니스
[얼굴 감지 결과] 얼굴 1: - 기쁨: VERY_LIKELY
질문: 이 회의의 분위기는 어떠한가요?"

당신의 응답: "## 회의 분위기 분석

이 회의는 프로젝트 X의 진행 상황을 보고하는 자리로, 전반적으로 긍정적이고 활기찬 분위기입니다.

### 핵심 분석
* 😊 참석자들의 기쁨 표정이 두드러짐
* 💻 노트북을 활용한 진행 상황 보고
* 🏢 사무실 환경에서의 비즈니스 미팅

### 추가 정보
* 회의실의 밝은 조명과 깔끔한 환경이 긍정적인 분위기를 조성"

예시 2 (질문 없음):
분석 결과: "[텍스트 분석 결과] 제품명: 스마트 워치 Pro
[감지된 물체] - 스마트워치 - 손목
[이미지 라벨] - 전자제품 - 웨어러블
[로고 감지 결과] - Apple
[관련 주제] - 건강 모니터링"

당신의 응답: "## 제품 분석

Apple의 스마트 워치 Pro는 건강 모니터링 기능을 강조하는 프리미엄 웨어러블 기기입니다.

### 핵심 분석
* ⌚ 손목에 착용된 스마트워치
* 🍎 Apple 브랜드 제품
* ❤️ 건강 모니터링 기능 강조

### 추가 정보
* 검은색과 흰색의 대비가 강한 세련된 디자인
* 웨어러블 기술과 건강 관리의 결합을 강조하는 마케팅 이미지"

제공된 이미지 분석 결과를 기반으로 마크다운 형식의 간결한 응답을 제공해주세요.`
        },
        { role: 'user', content: text },
      ],
      max_tokens: 500,
      temperature: 0.7,
    });

    const information = completion.choices[0]?.message?.content;
    if (!information || information.trim() === '') {
      throw new Error('OpenAI 응답이 비어 있습니다.');
    }
    return information;

  } catch (error) {
    console.error('정보 추출을 위해 OpenAI API 호출 중 오류:', error);
    if (error instanceof OpenAI.APIError) {
        return `OpenAI API 오류: ${error.status} ${error.name} ${error.message}`;
    }
    return 'OpenAI 응답이 없거나, 예기치 않은 오류로 인해 정보를 추출하지 못했습니다.';
  }
};

export interface TaskSuggestion {
  task: string;
  priority: '중요' | '보통' | '낮음';
}

/**
 * OCR 텍스트를 분석하여 수행해야 할 작업들을 제안합니다.
 * @param ocrText OCR로 추출된 텍스트
 * @returns 제안된 작업 목록
 */
export const suggestTasksFromOcr = async (ocrText: string | null): Promise<TaskSuggestion[]> => {
  try {
    if (!ocrText) {
      return [];
    }

    const prompt = `
      다음은 이미지에서 추출한 텍스트입니다. 이 텍스트를 바탕으로 수행해야 할 작업들을 제안해주세요.
      최소 3개 이상의 작업을 제안해주세요. 각각 다른 우선순위(high, medium, low)를 가진 작업을 포함해주세요.
      
      텍스트:
      ${ocrText}
    `;

    // 타임아웃 설정
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    const response = await openai.chat.completions.create({
      model: OPENAI_MODEL,
      messages: [
        {
          role: "system",
          content: `당신은 텍스트를 분석하여 수행해야 할 작업을 제안하는 어시스턴트입니다.
다음 규칙을 따라주세요:
1. 모든 응답은 반드시 한글로 작성해주세요.
2. 작업 제목은 간단명료하고 반드시 신뢰적으로 작성해주세요.
4. 반드시 3개 이상의 작업을 제안해주세요.
5. 각 작업은 다음 형식으로 작성해주세요:
   [우선순위] 작업 제목

6. 우선순위는 다음 기준으로 설정해주세요:
   - [중요]: 즉시 처리해야 하는 중요한 작업 (최소 1개)
   - [보통]: 곧 처리해야 하는 작업 (최소 1개)
   - [낮음]: 여유가 있을 때 처리해도 되는 작업 (최소 1개)`
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.7,
      // signal 추가해서 타임아웃 처리
    }, {
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    const content = response.choices[0]?.message?.content;
    if (!content) {
      return [];
    }

    // 텍스트 응답을 파싱하여 TaskSuggestion 배열로 변환
    const lines = content.split('\n');
    const suggestions: TaskSuggestion[] = [];
    let currentTask: Partial<TaskSuggestion> = {};

    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine) continue;

      // 우선순위와 제목이 있는 라인 처리
      if (trimmedLine.startsWith('[') && trimmedLine.includes(']')) {
        if (currentTask.task && currentTask.priority) {
          suggestions.push(currentTask as TaskSuggestion);
        }
        
        const priorityMatch = trimmedLine.match(/\[(.*?)\]/);
        const priority = priorityMatch ? priorityMatch[1] : '';
        const title = trimmedLine.split(']')[1].trim();
        
        currentTask = {
          task: title,
          priority: priority === '중요' ? '중요' : 
                   priority === '보통' ? '보통' : 
                   priority === '낮음' ? '낮음' : '보통',
        };
      }
    }

    // 마지막 작업 추가
    if (currentTask.task && currentTask.priority) {
      suggestions.push(currentTask as TaskSuggestion);
    }

    return suggestions;
  } catch (error) {
    console.error('Task suggestion error:', error);
    
    // AbortError 특별 처리
    if (error instanceof Error && error.name === 'AbortError') {
      console.log('OpenAI API 타임아웃 발생');
    }
    
    return [];
  }
};