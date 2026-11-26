# 기록의 근거와 수집 범위

기준 수집일: **2026-11-15 KST**. 당시 Git HEAD는 `e7d28a70028ff87a2934fbdf14d9cef21ba9ee5e`이며 작업 트리에 미커밋 변경이 있었다. 아래 해시는 학습 기록을 추가하기 전 로컬 파일의 SHA-256이다. HEAD가 모든 내용을 포함한다는 뜻이 아니다.

원본 문서는 계속 갱신된다. 해시는 기준 파일을 식별하지만 파일 자체를 복원하지는 못한다. 아래 핵심 발췌는 이 파일에 보존했고, 원본 전체의 별도 스냅샷이나 모든 채팅 내보내기는 만들지 않았다. 후속 변경은 새 기준 행·후속 기록으로 추가한다. 이후 STATUS·PLAN·ARCHITECTURE의 해시가 달라지는 것은 정상이다.

## 원본 목록

| ID  | 자료와 읽은 범위                                                             | 기준 SHA-256                                                       |
| --- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| E01 | [원래 인수인계](../RIPPLE_HANDOFF.md): 문제·대표 사용자·초기 범위·데모       | `60a7d3feeda97307f732df5e2b129c5e944e1aa86c93b370aa360b5414210b31` |
| E02 | [대회 감사](../HACKATHON_AUDIT.md): 11-14 판단과 보존된 역사적 감사          | `a4f1612a3e1e33332587db66dc007295188937b70d90522b0a4ae5cf64e07f30` |
| E03 | [제출 초안](../HACKATHON_SUBMISSION.md): 제품 방향·설명·녹화 계획·준비 상태  | `a102e787cbf70677f80bec924e47e040b317c8df48877170babfa54e9a188874` |
| E04 | [AI 의미 평가](../HACKATHON_SEMANTIC_ASSESSMENT.md): 판단·두 추론·범위       | `d2c415c4dc576d7ba30ee8360ddf8f490df151e6b55ee7e5104798c4f990b952` |
| E05 | [검토 작업공간](../CONSEQUENCE_WORKSPACE.md): 디자인 판단·구현 결과·한계     | `fee02d480ab5adc9deabacf0cdb2fef90befa99527264588ba19bd25bb656b5d` |
| E06 | [온보딩 감사](../ONBOARDING_AUDIT.md): 관측 문제·수정·검증·한계              | `4b35f317c31accce55da245750caefcb46111431e056a93c415bdb53af7eb08f` |
| E07 | [상태 이력](../STATUS.md): 언어 선택·개인 문서·샘플 안내·검증 범위           | `57f5f60e55db1cbedc8544fa6675931e666df0c4748518c0a737272745f8e6e0` |
| E08 | [실행 계획](../PLAN.md): 최근 UI 판단·비교안·평가 단계·진행 중 작업          | `d8938d414f79ccbc983332ea0f4137ad07aca9e7dbbd85f0c29c8ce53149a3c8` |
| E09 | [아키텍처](../ARCHITECTURE.md): 경계·불변 조건·UI 결정·평가와 한계           | `e48a67db77d550cd8888b6c5365c834491e8001e3ebdb10bf17463ce4bfd3d1d` |
| E10 | [의미 검토와 비교 프로토콜](../SEMANTIC_REVIEW.md): 사람 검토·수동 비교 방법 | `b35af9e6aa7c159d45a77d0c818dbc211f930b9ff092fc38e7e96bdd7a5392df` |

## 기준 시점 핵심 발췌

### E01

> Ripple은 관계를 근거로 재검토 대상을 제시한다. 연결된 작업이 잘못됐다고 자동 판정하거나 업무를 자동 수정하지 않는다. 최종 결정은 사용자가 유지, 수정, 보류로 기록한다.

### E02

> 전체 사람 검토를 제출 준비의 선행조건으로 삼지 않으며, 사람 검증이나 시간 절감 성과는 실제 확인 전까지 주장하지 않는다.

### E03

> Lead with the external **SemVer deprecation** scenario. A release-plan change is easier to explain than Ripple's internal database migration and shows convergent paths using an attributed public specification.

### E04

> The user delegated product direction; that instruction is not a human acceptance of any checklist subject.

### E05

> The user rejected cosmetic improvements as insufficient for the competition. This iteration changes the task itself: explore a proposed change, read the evidence while recording decisions, then take a portable decision brief away.

### E06

> This is not a recruited-user study or full accessibility certification.

### E07

> Final warning/error logs empty; blocking cleared, Network disabled, viewport reset and preview retained.

이는 언어 선택 작업의 브라우저 상태 기록이다. 오류 로그가 없었다는 사실은 사람의 이해도나 제품 수요를 증명하지 않는다.

### E08

> Next: observe whether new users can identify their next task without assistance.

### E09

> Opening evidence is an observable interaction, not proof of comprehension.

### E10

> Record ingestion, graph confirmation and reviewer training time separately; do not hide those costs inside a claim about total workflow savings.

## 수집하지 못했거나 아직 존재가 확인되지 않은 근거

- 아이디어 선정 이전의 전체 대화, 탈락한 아이디어 목록, 당시 비교 점수와 확신.
- 전체 개발 채팅·명령 로그의 완전한 내보내기, 결정별 실제 소요 시간·비용·중단한 시도 전부.
- 독립 사용자 인터뷰 원자료, 실제 고객 문서의 정답 판정, 사람의 비교 실험 결과.
- 최종 제출 영수증·최종 공개 영상·심사 점수·심사위원 피드백·수상 결과.

미수집과 미존재는 다르다. 추가 자료를 받으면 작성 시점·발견 시점·수집 범위를 나누어 연결한다. 실제 인용문이 없는 사용자 발언이나 검토한 적이 확인되지 않은 대안을 꾸며 넣지 않는다. 기존 감사에 적힌 공식 규정은 당시 확인 이력이며, 현재 규정은 제출 전 별도로 재확인한다.

## 추가 근거 양식

`E ID / 자료 종류 / 작성자·관찰자 역할 / 사건일 / 수집일 / 원문 위치·버전 / 핵심 발췌 / 직접 관측과 해석 구분 / 공개 가능 범위 / 관련 D·X ID`

개인 자료·참가자 신원·비공개 피드백은 공개 저장소에 원문을 넣지 않는다. 공개 가능한 요약과 참조 ID만 기록하고, 비공개 원본의 보관은 별도 승인된 위치를 사용한다.
