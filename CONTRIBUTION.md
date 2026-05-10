# Contribution Evidence

เอกสารนี้สรุปหลักฐานการทำงานร่วมกันของทีม CS332-CS232-CLOWN หลังจากดึง latest จาก GitHub แล้ว โดยอิงจาก commit history, branch/PR history, source code, test logs, deployment workflow และบทบาทที่ทีมแจ้งไว้ ณ วันที่ 10 พฤษภาคม 2026

เป้าหมายไม่ใช่การนับจำนวน commit ให้เท่ากัน แต่คือการทำให้ผู้ตรวจเห็นว่าแต่ละคนมี contribution จริงตามบทบาทของตนเอง และงานย่อยถูกบูรณาการเป็นระบบเดียว

## Project Evidence Hub

- Repository: <https://github.com/duckxy166/CS332-CS232-CLOWN>
- Web deployment: <https://duckxy166.github.io/CS332-CS232-CLOWN/>
- Architecture/setup: [README.md](README.md), [infrastructure/GUIDE.txt](infrastructure/GUIDE.txt)
- Frontend: [src/frontend](src/frontend)
- Backend/Lambda: [src/backend/functions](src/backend/functions)
- Deployment workflow: [.github/workflows/deploy.yml](.github/workflows/deploy.yml)
- Test evidence: [docs/TEST_LOG.md](docs/TEST_LOG.md), [scripts/sns-lab-results.json](scripts/sns-lab-results.json), [scripts/sns-lab-results-detail.json](scripts/sns-lab-results-detail.json)
- Integration evidence: [docs/INTEGRATION_EVIDENCE.md](docs/INTEGRATION_EVIDENCE.md)
- API/database/deployment notes: [docs/API_DATABASE_DEPLOYMENT_NOTES.md](docs/API_DATABASE_DEPLOYMENT_NOTES.md)
- Task board: [docs/TASK_BOARD.md](docs/TASK_BOARD.md)
- Quality review: [docs/QUALITY_REVIEW.md](docs/QUALITY_REVIEW.md)
- Demo checklist: [docs/DEMO_CHECKLIST.md](docs/DEMO_CHECKLIST.md)

## GitHub Identity Mapping

| สมาชิก | Git/GitHub identity ที่พบ | หมายเหตุ |
| --- | --- | --- |
| จรัสรวี วศินธรากร | `Charatrawi Wasintharakorn`, `Your Name <you@example.com>` | commit เก่าบางส่วนขึ้น `Your Name` จาก Git config เดิม |
| พรปวีณ์ แสนทวีสุข | `Phonpawee` | งาน submission/result/demo/testing |
| พาขวัญ จุลโยธิน | `PJ-ww`, `Pakhwan Julayothin` | งาน frontend, UI fixes, bug fixes จาก test |
| ภูรินทร์ แก้วพวงเสก | `Phurin`, `PhurinKaewpuangsek` | งาน architecture, UI system polish, standards |
| ศิริมงคล ดอนศรีโคตร | `SirimongkolDornsrikhot`, `Sirimongkol Doensrikhot`, `Sirimongkol Dornsrikhot` | งาน LLM, framework, security, sustainability |
| สหรัฐ อุดมวัฒน์ทวี | `สหรัฐ อุดมวัฒน์ทวี`, `duckxy166` | งานแบ่งงาน, integration, critical bug fixing, merge/release |
| กันตพัฒน์ ฉัตรภิรมย์เดช | `Kantaphat-C`, `Kantaphat C`, `Kantaphat Chatpiromdej` | งาน E2E test และ blur calculation |

## Member Contributions

| สมาชิก | รหัสนักศึกษา | บทบาทหลัก | งานที่ทำ | หลักฐาน |
| --- | --- | --- | --- | --- |
| จรัสรวี วศินธรากร | 6709650193 | Test, use case review, pain point/success review | ตรวจ flow และความสมเหตุสมผลของ use case, ทบทวน pain point ที่ระบบแก้, ระบุ success criteria และปรับ README ให้สื่อสารภาพรวมล่าสุด | Commit [a173ee6](https://github.com/duckxy166/CS332-CS232-CLOWN/commit/a173ee6), commit author `Your Name`: [d48b4e4](https://github.com/duckxy166/CS332-CS232-CLOWN/commit/d48b4e4), [e1ab065](https://github.com/duckxy166/CS332-CS232-CLOWN/commit/e1ab065), [28b6a92](https://github.com/duckxy166/CS332-CS232-CLOWN/commit/28b6a92); [docs/QUALITY_REVIEW.md](docs/QUALITY_REVIEW.md) |
| พรปวีณ์ แสนทวีสุข | 6709650490 | Test, demo video, test impact report | เตรียม demo flow, ทดสอบ submission/result/TA review, รายงานผล test ที่กระทบระบบหลัก | Commits [75439da](https://github.com/duckxy166/CS332-CS232-CLOWN/commit/75439da), [6a89004](https://github.com/duckxy166/CS332-CS232-CLOWN/commit/6a89004), [5e50292](https://github.com/duckxy166/CS332-CS232-CLOWN/commit/5e50292), [97b75da](https://github.com/duckxy166/CS332-CS232-CLOWN/commit/97b75da), [3b52c00](https://github.com/duckxy166/CS332-CS232-CLOWN/commit/3b52c00); [docs/DEMO_CHECKLIST.md](docs/DEMO_CHECKLIST.md), [docs/TEST_LOG.md](docs/TEST_LOG.md) |
| พาขวัญ จุลโยธิน | 6709650532 | Test, frontend error fixing | ทดสอบหน้าเว็บ, แก้ error/layout ที่พบจาก test, ปรับหน้า submission/result/lab list/TA view ให้ flow ต่อเนื่อง | Recent commits [097e407](https://github.com/duckxy166/CS332-CS232-CLOWN/commit/097e407), [79d559e](https://github.com/duckxy166/CS332-CS232-CLOWN/commit/79d559e), [56378d6](https://github.com/duckxy166/CS332-CS232-CLOWN/commit/56378d6); earlier commits [232b977](https://github.com/duckxy166/CS332-CS232-CLOWN/commit/232b977), [1e94d69](https://github.com/duckxy166/CS332-CS232-CLOWN/commit/1e94d69), [d0fd547](https://github.com/duckxy166/CS332-CS232-CLOWN/commit/d0fd547), [1b36022](https://github.com/duckxy166/CS332-CS232-CLOWN/commit/1b36022); [src/frontend](src/frontend) |
| ภูรินทร์ แก้วพวงเสก | 6709650573 | System diagram, cost, standards | ดูแลภาพรวมระบบและมาตรฐานงาน, ปรับ design system/UI polish, ควบคุมความสอดคล้องของ frontend กับ flow ที่ทีมกำหนด | Recent commits [be9fe37](https://github.com/duckxy166/CS332-CS232-CLOWN/commit/be9fe37), [6702e50](https://github.com/duckxy166/CS332-CS232-CLOWN/commit/6702e50); earlier commits [61cd646](https://github.com/duckxy166/CS332-CS232-CLOWN/commit/61cd646), [dc020a4](https://github.com/duckxy166/CS332-CS232-CLOWN/commit/dc020a4), [c0cc39c](https://github.com/duckxy166/CS332-CS232-CLOWN/commit/c0cc39c), [4ff16b9](https://github.com/duckxy166/CS332-CS232-CLOWN/commit/4ff16b9), [f56b935](https://github.com/duckxy166/CS332-CS232-CLOWN/commit/f56b935); [docs/INTEGRATION_EVIDENCE.md](docs/INTEGRATION_EVIDENCE.md) |
| ศิริมงคล ดอนศรีโคตร | 6709650631 | LLM system, framework analysis, security, sustainability | ดูแล LLM/vision checking, วิเคราะห์ framework/backend integration, ตรวจ security/sustainability และสิ่งที่ระบบควรเพิ่มหรือปรับปรุง | Commits [d67361b](https://github.com/duckxy166/CS332-CS232-CLOWN/commit/d67361b), [5a9ded4](https://github.com/duckxy166/CS332-CS232-CLOWN/commit/5a9ded4), [d19824b](https://github.com/duckxy166/CS332-CS232-CLOWN/commit/d19824b), [a49660a](https://github.com/duckxy166/CS332-CS232-CLOWN/commit/a49660a); [src/backend/functions/checker-engine/index.mjs](src/backend/functions/checker-engine/index.mjs), [scripts/setup-lifecycle-policy.sh](scripts/setup-lifecycle-policy.sh), [docs/QUALITY_REVIEW.md](docs/QUALITY_REVIEW.md) |
| สหรัฐ อุดมวัฒน์ทวี | 6709650680 | Task coordination, integration, critical bug fixing | แบ่งงาน, รวม branch/PR, เชื่อม frontend-backend, แก้ critical bug จาก test, เพิ่ม retry/backoff, caching, config, roster และ deployment workflow | Commits [bfdbf0b](https://github.com/duckxy166/CS332-CS232-CLOWN/commit/bfdbf0b), [b3ef884](https://github.com/duckxy166/CS332-CS232-CLOWN/commit/b3ef884), [55ca1df](https://github.com/duckxy166/CS332-CS232-CLOWN/commit/55ca1df), [8926538](https://github.com/duckxy166/CS332-CS232-CLOWN/commit/8926538), [3500c45](https://github.com/duckxy166/CS332-CS232-CLOWN/commit/3500c45), [b5d0530](https://github.com/duckxy166/CS332-CS232-CLOWN/commit/b5d0530), [940f765](https://github.com/duckxy166/CS332-CS232-CLOWN/commit/940f765); [.github/workflows/deploy.yml](.github/workflows/deploy.yml) |
| กันตพัฒน์ ฉัตรภิรมย์เดช | 6709650151 | End-to-end test, user-perspective testing, blur calculation | จำลองมุมมองผู้ใช้จริง, ตรวจ route/login/setup, ปรับสมการ/threshold ความเบลอของภาพให้เหมาะกับการใช้งานจริง | Commits [1f24088](https://github.com/duckxy166/CS332-CS232-CLOWN/commit/1f24088), [3395c51](https://github.com/duckxy166/CS332-CS232-CLOWN/commit/3395c51), [4448810](https://github.com/duckxy166/CS332-CS232-CLOWN/commit/4448810), [00f8da6](https://github.com/duckxy166/CS332-CS232-CLOWN/commit/00f8da6), [64a3568](https://github.com/duckxy166/CS332-CS232-CLOWN/commit/64a3568), [07e6c61](https://github.com/duckxy166/CS332-CS232-CLOWN/commit/07e6c61), [52b539b](https://github.com/duckxy166/CS332-CS232-CLOWN/commit/52b539b); [src/frontend/student/submissionPage_script.js](src/frontend/student/submissionPage_script.js), [docs/TEST_LOG.md](docs/TEST_LOG.md) |

## Cross-Component Collaboration

| Integration point | ผู้เกี่ยวข้อง | หลักฐาน |
| --- | --- | --- |
| Web frontend to API config | สหรัฐ, ศิริมงคล, พาขวัญ, พรปวีณ์ | [src/frontend/api-config.js](src/frontend/api-config.js), [src/frontend/student](src/frontend/student), [src/frontend/TA](src/frontend/TA) |
| TA create lab to backend storage | ภูรินทร์, สหรัฐ, ศิริมงคล | [src/backend/functions/lab-config/index.mjs](src/backend/functions/lab-config/index.mjs), [src/backend/functions/reference-upload/index.mjs](src/backend/functions/reference-upload/index.mjs) |
| Student upload to async checking | สหรัฐ, ภูรินทร์, ศิริมงคล, กันตพัฒน์ | [src/backend/functions/submission-handler/index.mjs](src/backend/functions/submission-handler/index.mjs), [src/backend/functions/checker-engine/index.mjs](src/backend/functions/checker-engine/index.mjs) |
| Result polling and TA review | พรปวีณ์, พาขวัญ, สหรัฐ | [src/backend/functions/result-reader/index.mjs](src/backend/functions/result-reader/index.mjs), [src/backend/functions/submission-viewer/index.mjs](src/backend/functions/submission-viewer/index.mjs), [src/frontend/TA/TaViewSubmission_script.js](src/frontend/TA/TaViewSubmission_script.js) |
| LLM/OCR quality and sustainability | ศิริมงคล, สหรัฐ, ภูรินทร์ | [src/backend/functions/checker-engine/index.mjs](src/backend/functions/checker-engine/index.mjs), [scripts/setup-lifecycle-policy.sh](scripts/setup-lifecycle-policy.sh), [docs/QUALITY_REVIEW.md](docs/QUALITY_REVIEW.md) |
| E2E/manual testing and demo | จรัสรวี, พรปวีณ์, พาขวัญ, กันตพัฒน์ | [docs/TEST_LOG.md](docs/TEST_LOG.md), [docs/DEMO_CHECKLIST.md](docs/DEMO_CHECKLIST.md), [scripts/sns-lab-results.json](scripts/sns-lab-results.json) |

## Evidence Quality Notes

- งานที่ไม่ใช่โค้ดถูกเก็บใน repo ผ่าน task board, test log, quality review, integration notes, API/database/deployment notes และ demo checklist
- งาน integration มีหลักฐานทั้ง source code, README/setup, GitHub Pages workflow, branch/PR merge และ E2E test logs
- งาน test บันทึกผลกระทบต่อระบบหลัก เช่น false pass, blur threshold, result polling, TA review และ demo flow
- ความต่างของจำนวน commit ไม่ได้แปลว่า contribution ไม่เท่ากัน เพราะบางบทบาทเป็น review/test/demo/coordination ซึ่งสะท้อนผ่านเอกสารและ task evidence มากกว่า code commit

