import { OPENAI_API_KEY } from '@env';
import OpenAI from 'openai';

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
 * OpenAI API를 사용하여 STT로 변환된 음성 텍스트를 분석합니다.
 * @param speechText STT로 변환된 텍스트
 * @param contextText 컨텍스트 정보 (이미지 OCR 결과, 물체 인식 결과 등)
 * @returns 분석 결과 또는 오류 메시지를 반환하는 Promise 객체
 */
export const analyzeSpeechText = async (
  speechText: string, 
  contextText?: string
): Promise<string> => {
  if (!speechText) {
    return '분석할 음성 텍스트가 제공되지 않았습니다.';
  }

  try {
    const completion = await openai.chat.completions.create({
      model: OPENAI_MODEL,
      messages: [
        { 
          role: 'system', 
          content: `당신은 음성 명령과 질문을 분석하고 응답하는 전문가입니다. 사용자의 음성을 텍스트로 변환한 내용을 분석하여 의도를 파악하고 적절한 답변을 제공해주세요.

문맥을 고려하여 핵심 요점을 명확하게 전달하세요. 응답은 가능한 간결하고 자연스러운 대화체로 작성하세요.

음성 명령 처리 특성에 맞게:
1. 명확하고 간결한 응답 제공
2. 핵심 정보 우선 전달
3. 필요한 경우에만 선택적으로 세부 정보 제공
4. 질문이 명확하지 않을 경우 가장 가능성 높은 의도를 추론

컨텍스트 정보가 제공된 경우(이미지 분석 결과 등), 이를 활용하여 더 정확한 답변을 제공해주세요.`
        },
        { 
          role: 'user', 
          content: contextText 
            ? `컨텍스트 정보:\n${contextText}\n\n음성 질문/명령:\n${speechText}` 
            : speechText 
        },
      ],
      max_tokens: 300,
      temperature: 0.7,
    });

    const information = completion.choices[0]?.message?.content;
    if (!information || information.trim() === '') {
      throw new Error('OpenAI 응답이 비어 있습니다.');
    }
    
    return information;

  } catch (error) {
    console.error('음성 텍스트 분석을 위한 OpenAI API 호출 중 오류:', error);
    if (error instanceof OpenAI.APIError) {
      return `OpenAI API 오류: ${error.status} ${error.name} ${error.message}`;
    }
    return '음성 분석 중 예기치 않은 오류가 발생했습니다.';
  }
};

/**
 * 음성 명령에서 사용자의 의도를 추출합니다.
 * @param speechText STT로 변환된 텍스트
 * @returns 추출된 의도 객체
 */
export interface SpeechIntent {
  intent: 'QUESTION' | 'COMMAND' | 'INFORMATION' | 'UNCLEAR';
  confidence: number;
  action?: string;
  parameters?: Record<string, string>;
}

export const extractIntentFromSpeech = async (
  speechText: string
): Promise<SpeechIntent> => {
  try {
    if (!speechText || speechText.trim() === '') {
      return {
        intent: 'UNCLEAR',
        confidence: 0,
      };
    }

    const response = await openai.chat.completions.create({
      model: OPENAI_MODEL,
      messages: [
        {
          role: "system",
          content: `당신은 음성 명령 분석 전문가입니다. 사용자의 음성을 텍스트로 변환한 내용에서 의도를 추출하세요.
다음 형식으로 JSON 객체만 반환하세요:
{
  "intent": "QUESTION" | "COMMAND" | "INFORMATION" | "UNCLEAR",
  "confidence": 0부터 1 사이의 숫자,
  "action": "동작 설명 (선택적)",
  "parameters": {
    "param1": "값1",
    "param2": "값2"
  }
}`
        },
        {
          role: "user",
          content: speechText
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('의도 추출 응답이 비어 있습니다.');
    }

    try {
      return JSON.parse(content) as SpeechIntent;
    } catch (parseError) {
      console.error('의도 추출 결과 파싱 오류:', parseError);
      return {
        intent: 'UNCLEAR',
        confidence: 0,
      };
    }
  } catch (error) {
    console.error('의도 추출 중 오류:', error);
    return {
      intent: 'UNCLEAR',
      confidence: 0,
    };
  }
};

/**
 * OCR 결과와 음성 질문을 결합하여 질문에 대한 답변을 생성합니다.
 * @param question 음성으로 입력된 질문
 * @param ocrText OCR로 추출된 텍스트
 * @param analysisResult 이미지 분석 결과 (객체 감지 등)
 * @returns 질문에 대한 답변
 */
export const answerQuestionFromSpeech = async (
  question: string,
  ocrText?: string,
  analysisResult?: any
): Promise<string> => {
  try {
    if (!question) {
      return '질문을 인식할 수 없습니다.';
    }

    // 컨텍스트 정보 구성
    let context = '';
    
    if (ocrText) {
      context += `[텍스트 분석 결과]\n${ocrText}\n\n`;
    }
    
    if (analysisResult) {
      // 물체 감지 결과 추가
      if (analysisResult.objects && analysisResult.objects.length > 0) {
        context += '[감지된 물체]\n';
        analysisResult.objects.forEach((obj: any) => {
          context += `- ${obj.name} (신뢰도: ${Math.round(obj.confidence * 100)}%)\n`;
        });
        context += '\n';
      }
      
      // 이미지 라벨 추가
      if (analysisResult.labels && analysisResult.labels.length > 0) {
        context += '[이미지 라벨]\n';
        analysisResult.labels.forEach((label: any) => {
          context += `- ${label.description} (신뢰도: ${Math.round(label.confidence * 100)}%)\n`;
        });
        context += '\n';
      }
    }

    // 음성 특화 프롬프트
    const prompt = `${context}질문: ${question}`;

    const completion = await openai.chat.completions.create({
      model: OPENAI_MODEL,
      messages: [
        { 
          role: 'system', 
          content: `당신은 이미지/영상 분석 결과와 음성 질문을 받아 자연스럽고 친근한 대화체로 답변하는 AI 비서입니다.

답변 작성 원칙:
1. 자연스러운 대화체 사용 (예: "이 사진은 ~네요", "이 영상에서는 ~이 보여요")
2. 간결하고 명확한 설명 제공
3. 불필요한 서론이나 결론 없이 핵심 내용 전달
4. TTS로 읽기 적합한 자연스러운 문장 구조 사용
5. 정보가 부족할 경우, 있는 정보만으로 최대한 유용한 답변 제공

특히 "무슨 사진이야?", "무슨 영상이야?"와 같은 일반적인 질문에 대해:
- 감지된 물체나 라벨을 자연스럽게 문장으로 구성
- "이 사진/영상에서는 ~이 보여요"와 같은 형식으로 시작
- 주요 특징이나 내용을 간단히 설명
- 텍스트가 있다면 그 내용도 자연스럽게 포함

예시 답변:
"이 사진에서는 책상 위에 노트북과 커피잔이 놓여있네요. 사무실 환경에서 일하는 모습이 보여요."

"이 영상에서는 사람들이 회의실에서 회의를 하고 있어요. 화면에 '프로젝트 진행 상황'이라는 텍스트가 보이네요."

가능한 자연스럽고 친근한 대화 방식으로 응답해주세요.`
        },
        { role: 'user', content: prompt },
      ],
      max_tokens: 250,
      temperature: 0.7,
    });

    const answer = completion.choices[0]?.message?.content;
    if (!answer || answer.trim() === '') {
      throw new Error('응답이 비어 있습니다.');
    }

    return answer;
  } catch (error) {
    console.error('질문 답변 생성 중 오류:', error);
    return '질문에 답변하는 동안 오류가 발생했습니다.';
  }
};

/**
 * 음성 대화에 적합한 응답을 생성합니다.
 * @param userText 사용자의 발화 텍스트
 * @param contextInfo 대화 컨텍스트 정보 
 * @returns TTS로 읽기 적합한 응답 텍스트
 */
export const generateSpeechResponse = async (
  userText: string,
  contextInfo?: string
): Promise<string> => {
  try {
    if (!userText) {
      return '음성 명령을 인식할 수 없습니다.';
    }

    const prompt = contextInfo
      ? `컨텍스트 정보:\n${contextInfo}\n\n사용자 발화:\n${userText}`
      : `사용자 발화:\n${userText}`;

    const completion = await openai.chat.completions.create({
      model: OPENAI_MODEL,
      messages: [
        { 
          role: 'system', 
          content: `당신은 자연스럽고 간결한 대화형 응답을 생성하는 음성 비서입니다.
응답 작성 원칙:
1. 간결하게: 짧고 명확한 문장 사용
2. 자연스럽게: 구어체 활용
3. 직접적으로: 핵심 내용 먼저 전달
4. 친근하게: 편안한 어조 유지
5. 청각적으로 구분이 용이하도록: 복잡한 구조 피하기

TTS(Text-to-Speech)로 읽기에 최적화된 응답을 제공하세요.`
        },
        { role: 'user', content: prompt },
      ],
      max_tokens: 200,
      temperature: 0.7,
    });

    const response = completion.choices[0]?.message?.content;
    if (!response || response.trim() === '') {
      throw new Error('응답이 비어 있습니다.');
    }

    return response;
  } catch (error) {
    console.error('음성 응답 생성 중 오류:', error);
    return '응답을 생성하는 동안 문제가 발생했습니다.';
  }
};