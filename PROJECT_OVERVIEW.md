# EcuBus-Pro 프로젝트 개요

## 프로젝트 목적

**EcuBus-Pro**는 자동차 ECU(Electronic Control Unit, 전자 제어 장치) 개발 및 진단을 위한 오픈소스 크로스플랫폼 데스크탑 도구입니다.

상용 자동차 진단 도구(예: CAN-OE)를 대체하는 무료 솔루션으로, 자동차 소프트웨어 개발자 및 엔지니어가 ECU와 통신하고, 진단하고, 테스트하는 모든 작업을 하나의 통합 환경에서 수행할 수 있도록 설계되었습니다.

### 핵심 가치

- 🆓 **오픈소스 & 무료** – 상용 라이선스 없이 사용 가능
- 🚀 **현대적인 UI** – 직관적이고 사용하기 쉬운 인터페이스
- 💻 **크로스플랫폼** – Windows, Linux, macOS 모두 지원
- 🔌 **다양한 하드웨어 지원** – 여러 벤더의 CAN/LIN 어댑터 호환

---

## 주요 기능

### 1. 통신 프로토콜 지원
- **CAN / CAN-FD** – 자동차 네트워크의 가장 널리 쓰이는 프로토콜
- **LIN** – 저비용 단일 마스터 직렬 통신 프로토콜
- **DoIP (Diagnostic over IP)** – 이더넷 기반 진단 프로토콜
- **SOME/IP** – 서비스 지향 미들웨어 프로토콜 (오토사 기반)

### 2. 진단 (UDS)
- ISO 14229 기반의 UDS(Unified Diagnostic Services) 지원
- ECU 소프트웨어 업데이트(플래싱), DTC 읽기/지우기, 데이터 파라미터 조회 등

### 3. 스크립팅
- **TypeScript 기반 스크립팅** – 반복 작업 자동화 및 복잡한 시나리오 구성
- 커스텀 시퀀스 작성, 자동 테스트 스크립트 구현 가능

### 4. HIL 테스트 프레임워크
- Hardware-in-the-Loop(HIL) 방식의 자동화 테스트 지원
- 반복 검증 및 회귀 테스트를 자동으로 실행

### 5. 데이터베이스 지원
- **CAN DBC 파일** – CAN 메시지 정의 파일 뷰어
- **LIN LDF 파일** – LIN 설명자 파일 편집 및 내보내기

### 6. 데이터 시각화
- 실시간 신호 그래프 및 분석 기능
- 트레이스(Trace) 뷰로 통신 패킷 모니터링

### 7. CLI (Command Line Interface)
- 터미널에서 직접 사용 가능한 명령줄 도구
- CI/CD 파이프라인 통합 및 자동화 스크립트에 활용

### 8. 패널 빌더
- 드래그 앤 드롭 방식의 커스텀 UI 인터페이스 제작
- 맞춤형 제어 패널 구성 가능

### 9. 플러그인 시스템
- 확장 가능한 플러그인 아키텍처
- 마켓플레이스를 통한 기능 추가

---

## 지원 하드웨어

| 벤더 | 지원 프로토콜 |
|------|-------------|
| **EcuBus-LinCable** | LIN, PWM |
| **PEAK** | CAN, CAN-FD, LIN |
| **KVASER** | CAN, CAN-FD, LIN |
| **ZLG** | CAN, CAN-FD |
| **Toomotss** | CAN, CAN-FD, LIN |
| **VECTOR** | CAN, CAN-FD, LIN |
| **SLCAN** | CAN, CAN-FD |
| **GS_USB (CANDLE)** | CAN, CAN-FD |
| 시뮬레이션 모드 | (하드웨어 없이 동작) |

---

## 프로젝트 구조 (개략)

```
EcuBus-Pro/
├── src/
│   ├── main/         # Electron 메인 프로세스 (백엔드 로직)
│   ├── renderer/     # Vue.js 기반 UI (프론트엔드)
│   ├── cli/          # 명령줄 인터페이스
│   └── preload/      # Electron 프리로드 스크립트
├── docs/             # VitePress 문서 (영어/중국어)
├── resources/        # 런타임 리소스
├── build/            # 빌드 설정 및 아이콘
├── test/             # 테스트 코드
└── tools/            # 빌드 유틸리티
```

### 기술 스택

| 구분 | 기술 |
|------|------|
| **데스크탑 프레임워크** | Electron |
| **프론트엔드** | Vue 3, Element Plus, ECharts |
| **언어** | TypeScript |
| **빌드 도구** | electron-vite, Vite, Webpack |
| **네이티브 모듈** | Node.js C++ 바인딩 (CAN, LIN, SOME/IP) |
| **문서** | VitePress |
| **테스트** | Vitest |

---

## 개략적인 사용 방법

### 설치

공식 릴리스 페이지 또는 AUR(Linux)에서 설치 파일을 내려받아 설치합니다.

- **Windows**: `.exe` 인스톨러 실행
- **Linux**: `.deb` 또는 `.rpm` 패키지 설치, 또는 AUR 사용
- **macOS**: `.dmg` 파일 실행

### 기본 사용 흐름

1. **하드웨어 연결** – 지원하는 CAN/LIN 어댑터를 PC에 연결
2. **프로젝트 생성** – 앱 실행 후 새 프로젝트 생성
3. **채널 설정** – 사용할 하드웨어와 통신 속도(Baudrate) 설정
4. **통신 시작** – CAN/LIN 메시지 송수신 및 모니터링
5. **진단 실행** – UDS 서비스를 통해 ECU 진단 및 제어
6. **스크립트 작성** – TypeScript로 자동화 시퀀스 구성
7. **테스트 실행** – HIL 테스트 프레임워크로 자동화 검증

### CLI 사용

하드웨어나 GUI 없이 터미널에서 바로 사용할 수 있습니다.

```bash
# CLI 도구 실행 예시
ecubus-pro --help
```

CLI를 활용하면 CI/CD 파이프라인 또는 자동화 스크립트에 통합하여 ECU 테스트를 자동으로 수행할 수 있습니다.

---

## 문서

- 공식 문서 (영어): [https://app.whyengineer.com](https://app.whyengineer.com)
- 공식 문서 (중국어): [https://app.whyengineer.com/zh](https://app.whyengineer.com/zh)

---

## 라이선스

[Apache License 2.0](./license.txt)
