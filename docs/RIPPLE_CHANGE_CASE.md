# Ripple 자체 변경 사례: 리뷰 저장 계약 강화

2026-11-26 KST. 사용자가 선택한 실제 Ripple 변경을 개발 에이전트가 사례로 구성했다. 독립 사용자 연구, 자동 코드 분석, 새로 발견한 누락 작업 또는 시간 절감 실험으로 취급하지 않는다.

## 실제 변경과 후속 작업

기존 리뷰 API는 `status`와 `reason`만 받았다. 같은 상태를 읽은 두 탭이 순서대로 저장하면 오래된 탭의 판단도 받아들였다. 현재 API는 `expectedRevision`과 UUID `requestId`를 함께 요구한다. 오래된 저장은 409로 거절하고, 같은 요청의 재시도는 이력을 중복 생성하지 않는다. 구형 요청은 400으로 거절하므로 실제 호출자를 함께 바꿔야 한다.

| 항목     | 근거와 실제 후속 작업                                                                                                 | 시연의 판단                            |
| -------- | --------------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| UI_SAVE  | `src/App.tsx`의 PUT payload에 읽은 revision과 재시도 ID를 포함                                                        | Revise                                 |
| WORKER   | `scripts/evaluation/worker.ts`의 두 PUT 호출에 동일한 ID와 최초 revision 사용                                         | Revise                                 |
| RECOVERY | UI 저장 오류 처리에 있던 초안 보존 요구를 유지하면서 명시적 충돌 비교 추가                                            | Keep: 요구 유지, 구현 완료라는 뜻 아님 |
| BUNDLE   | `prepareJudgeSnapshot`이 `runPhase('write')`를 통해 worker를 실행하므로 worker 수정 뒤 심사용 native DB를 재생성·검사 | Defer: 검증 전 공개 보류               |
| LANGUAGE | 언어 선택 저장 키는 리뷰 API와 연결되지 않음                                                                          | 영향 후보에서 제외                     |

저장된 관계 방향은 `downstream -[:DEPENDS_ON]-> upstream`이다. native Relate가 반환하는 네 경로는 `UI_SAVE>API`, `WORKER>API`, `RECOVERY>UI_SAVE>API`, `BUNDLE>WORKER>API`다. API 자신은 제외한다. UI의 지도 화살표는 변경이 전달되는 방향을 읽기 쉽게 표시한다. 기본 inventory 샘플도 같은 격리 저장소에 있으므로 화면의 **Outside this ripple 7**은 LANGUAGE와 샘플 6개를 합한 값이다.

BUNDLE→WORKER는 직접 import 문장 하나가 아니라 `prepareJudgeSnapshot`→`runPhase`→worker의 호출 연결을 요약한 관계다. 별도 RUNNER 인용에 자식 프로세스 실행이 보존되어 있다. 네 관계 모두 작성자가 확인한 모델이며, 구문 분석기가 자동 도출한 의존성이 아니다.

## 고정 원문과 준비 비용

[`evaluation/ripple-review-contract.json`](../evaluation/ripple-review-contract.json)의 ID는 `ripple-review-contract-v1`이다. 변경 전에 실제 작업 트리에서 코드 6개를 발췌하고 SHA-256, 원래 파일의 UTF-16 범위, 발췌 문자열을 고정했다. 모두 `commit: null`이다. 당시 미커밋 파일과 줄바꿈을 공개 커밋의 바이트라고 주장하지 않는다. 앱 안의 evidence 범위는 저장된 발췌 문자열 기준이며 end-exclusive다. 원본 전체 파일의 범위와 혼동하지 않는다. 인용은 Ripple 자체 MIT 소스다.

| 수량                            | 범위                                                              |
| ------------------------------- | ----------------------------------------------------------------- |
| 원문 6개                        | API 계약, 브라우저 저장, worker, bundle, runner, 언어 설정        |
| 항목 6개                        | 변경 대상 1개, 검토 후보 4개, 제외 대조 1개                       |
| confirmed 관계 4개              | 작성자가 인용을 선택하고 확인한 관계                              |
| 준비 API 쓰기 21회              | 원문 6 + 항목 6 + 관계 생성/확인 8 + 제안 1                       |
| 자동 준비 160ms                 | 이번 격리 QA 실행에서 관측; 성능 벤치마크나 사용자 시간 절감 아님 |
| 원문 읽기·모델링·설명 작성 시간 | 계측하지 않음. 위 자동 준비 시간에 포함되지 않음                  |

현재 후속 코드를 작성한 것과 사례에 판단을 기록한 것은 별개다. worker 원문의 v2를 Documents에서 저장한 시연은 v1 인용을 덮어쓰지 않고 최신 원문 비교 안내를 표시한다. 서로 다른 항목의 Keep/Revise/Defer는 연결 후보가 곧 실패 예측은 아니라는 점도 보여준다.

## 재현

```powershell
npm ci
npm run evaluate:ripple
npm run evaluate:ripple:demo
```

demo는 앱을 빌드하고 별도 저장소를 만든다. 기본 포트는 **4326**이며 출력된 proposal/item 전체 URL을 연다. **Rebuild the judge store after the API change**를 선택해 두 링크의 원문을 확인하고 Apply 후 판단을 저장한다. API 키가 필요 없다.

심사용 고정 저장소는 `npm run judge:prepare:ripple`로 만든다. 출력된 디렉터리에 대해 `npm run judge:inspect -- BUNDLE_DIRECTORY`로 별도 프로세스 read-only 검사를 실행한다. 실행할 때는 `npm run judge:start -- BUNDLE_DIRECTORY`를 사용한다. 원본을 수정하지 않고 별도 작업 사본을 연다. fixture에는 작성자가 정한 Defer 하나가 있고, 영상의 네 판단이 있는 저장소는 별개다.

실제 구현과 브라우저·패키지 검증은 [개선 보고서](HACKATHON_IMPROVEMENTS_2026-11-26.md), [QA](QA.md), [STATUS](STATUS.md)에 기록한다. 기존 ownership/SemVer 두 사례의 원문과 의미 판단 기록은 유지한다. 현재 semantic worksheet는 세 사례 **51개 항목**을 제공하며, 기존 자동 평가 39개가 새 사례의 12개를 독립적으로 승인한 것은 아니다.

## 아직 주장할 수 없는 것

이 사례는 이번 변경의 실제 호출자와 후속 작업을 재현한다. 처음 보는 사용자가 관계를 준비하고 유지하는 비용보다 더 큰 이익을 얻는지, 기존 검색·리뷰보다 누락을 줄이는지, 연결된 작업이 실제로 반드시 바뀌는지는 입증하지 않는다. 그런 주장은 [독립 관찰 및 수동 비교 계획](SEMANTIC_REVIEW.md)의 별도 실험이 필요하다.
