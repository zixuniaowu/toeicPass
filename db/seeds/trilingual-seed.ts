/**
 * Trilingual Seed Script
 *
 * Generates 50 test vocabulary cards with Chinese, Japanese, and English
 * annotations for development and QA environments.
 *
 * Usage:
 *   npx tsx db/seeds/trilingual-seed.ts
 *
 * Environment variables:
 *   DATABASE_URL   — PostgreSQL connection string (optional; dry-run if absent)
 *   SEED_TENANT_ID — Target tenant UUID (optional; creates demo tenant if absent)
 *   SEED_USER_ID   — Target user UUID (optional; creates demo user if absent)
 */

// ── Seed data ──────────────────────────────────────────────────────────────────

interface TrilingualCard {
  term: string;           // English term
  pos: string;            // Part of speech
  definition_en: string;
  definition_zh: string;  // Chinese translation
  definition_ja: string;  // Japanese translation
  example_en: string;
  example_zh: string;
  example_ja: string;
  source_part: number;
  difficulty: number;     // 1–5
  cefr_level: string;
  score_band: string;
}

const TRILINGUAL_CARDS: TrilingualCard[] = [
  { term: "accommodate", pos: "v", definition_en: "to provide lodging or space for", definition_zh: "容纳，提供住宿", definition_ja: "収容する、宿泊施設を提供する", example_en: "The hotel can accommodate up to 300 guests.", example_zh: "这家酒店最多可容纳300位客人。", example_ja: "そのホテルは最大300人の宿泊客を収容できます。", source_part: 7, difficulty: 3, cefr_level: "B2", score_band: "700-800" },
  { term: "adjacent", pos: "adj", definition_en: "next to or adjoining something else", definition_zh: "毗邻的，邻近的", definition_ja: "隣接した", example_en: "The conference room is adjacent to the lobby.", example_zh: "会议室毗邻大厅。", example_ja: "会議室はロビーの隣にあります。", source_part: 5, difficulty: 3, cefr_level: "B2", score_band: "700-800" },
  { term: "agenda", pos: "n", definition_en: "a list of items to be discussed at a meeting", definition_zh: "议程", definition_ja: "議題", example_en: "Please review the agenda before tomorrow's meeting.", example_zh: "请在明天的会议前查看议程。", example_ja: "明日の会議の前に議題を確認してください。", source_part: 6, difficulty: 2, cefr_level: "B1", score_band: "600-700" },
  { term: "allocate", pos: "v", definition_en: "to distribute resources for a specific purpose", definition_zh: "分配，拨款", definition_ja: "配分する、割り当てる", example_en: "The manager allocated funds to each department.", example_zh: "经理向每个部门分配了资金。", example_ja: "マネージャーは各部門に資金を配分した。", source_part: 7, difficulty: 3, cefr_level: "B2", score_band: "700-800" },
  { term: "anticipate", pos: "v", definition_en: "to expect or predict something", definition_zh: "预期，预见", definition_ja: "予期する、見越す", example_en: "We anticipate strong demand for the new product.", example_zh: "我们预期新产品需求旺盛。", example_ja: "新製品への強い需要を見込んでいます。", source_part: 5, difficulty: 3, cefr_level: "B2", score_band: "700-800" },
  { term: "authorize", pos: "v", definition_en: "to give official permission for something", definition_zh: "授权，批准", definition_ja: "承認する、許可する", example_en: "Only the director can authorize large purchases.", example_zh: "只有主任才能批准大额采购。", example_ja: "大きな購入を承認できるのは取締役だけです。", source_part: 6, difficulty: 3, cefr_level: "B2", score_band: "700-800" },
  { term: "benchmark", pos: "n", definition_en: "a standard used for comparison or evaluation", definition_zh: "基准，标杆", definition_ja: "基準、ベンチマーク", example_en: "Sales figures serve as a benchmark for performance.", example_zh: "销售数字作为绩效基准。", example_ja: "売上高がパフォーマンスの基準となります。", source_part: 7, difficulty: 4, cefr_level: "C1", score_band: "800-900" },
  { term: "collaborate", pos: "v", definition_en: "to work jointly on an activity or project", definition_zh: "合作，协作", definition_ja: "協力する、共同作業する", example_en: "The two teams collaborated on the new marketing strategy.", example_zh: "两个团队在新营销策略上进行了合作。", example_ja: "2つのチームが新しいマーケティング戦略で協力しました。", source_part: 6, difficulty: 2, cefr_level: "B1", score_band: "600-700" },
  { term: "commute", pos: "v/n", definition_en: "to travel regularly to and from work", definition_zh: "通勤", definition_ja: "通勤する", example_en: "She commutes by train every morning.", example_zh: "她每天早上乘火车通勤。", example_ja: "彼女は毎朝電車で通勤します。", source_part: 1, difficulty: 2, cefr_level: "B1", score_band: "600-700" },
  { term: "comply", pos: "v", definition_en: "to act in accordance with rules or requests", definition_zh: "遵从，服从", definition_ja: "従う、遵守する", example_en: "All employees must comply with safety regulations.", example_zh: "所有员工必须遵守安全法规。", example_ja: "全従業員は安全規則を遵守しなければなりません。", source_part: 5, difficulty: 3, cefr_level: "B2", score_band: "700-800" },
  { term: "comprehensive", pos: "adj", definition_en: "including or dealing with all aspects", definition_zh: "全面的，综合的", definition_ja: "包括的な、総合的な", example_en: "The report provides a comprehensive overview of the market.", example_zh: "该报告提供了市场的全面概述。", example_ja: "報告書は市場の包括的な概要を提供しています。", source_part: 7, difficulty: 3, cefr_level: "B2", score_band: "700-800" },
  { term: "confidential", pos: "adj", definition_en: "intended to be kept secret", definition_zh: "机密的，保密的", definition_ja: "機密の", example_en: "Please keep this information confidential.", example_zh: "请对此信息保密。", example_ja: "この情報は秘密にしてください。", source_part: 6, difficulty: 2, cefr_level: "B1", score_band: "600-700" },
  { term: "consecutive", pos: "adj", definition_en: "following in uninterrupted sequence", definition_zh: "连续的", definition_ja: "連続した", example_en: "The company achieved record sales for five consecutive quarters.", example_zh: "该公司连续五个季度实现了创纪录的销售额。", example_ja: "同社は5四半期連続で記録的な売上を達成しました。", source_part: 7, difficulty: 3, cefr_level: "B2", score_band: "700-800" },
  { term: "consult", pos: "v", definition_en: "to seek advice or information from someone", definition_zh: "咨询，商量", definition_ja: "相談する、諮問する", example_en: "You should consult a lawyer before signing the contract.", example_zh: "您应在签署合同前咨询律师。", example_ja: "契約書に署名する前に弁護士に相談すべきです。", source_part: 5, difficulty: 2, cefr_level: "B1", score_band: "600-700" },
  { term: "deadline", pos: "n", definition_en: "the latest time by which something must be done", definition_zh: "截止日期，最后期限", definition_ja: "締め切り、期限", example_en: "The deadline for the report is next Friday.", example_zh: "报告的截止日期是下周五。", example_ja: "報告書の締め切りは来週の金曜日です。", source_part: 3, difficulty: 1, cefr_level: "B1", score_band: "600-700" },
  { term: "delegate", pos: "v", definition_en: "to assign a task to another person", definition_zh: "委派，授权", definition_ja: "委任する、委託する", example_en: "The manager delegates tasks to team members.", example_zh: "经理将任务委派给团队成员。", example_ja: "マネージャーはチームメンバーにタスクを委任します。", source_part: 5, difficulty: 3, cefr_level: "B2", score_band: "700-800" },
  { term: "determine", pos: "v", definition_en: "to ascertain or establish exactly", definition_zh: "确定，决定", definition_ja: "決定する、確認する", example_en: "We need to determine the cause of the problem.", example_zh: "我们需要确定问题的原因。", example_ja: "問題の原因を特定する必要があります。", source_part: 7, difficulty: 2, cefr_level: "B1", score_band: "600-700" },
  { term: "efficiently", pos: "adv", definition_en: "in a way that achieves maximum productivity", definition_zh: "高效地", definition_ja: "効率的に", example_en: "The new software processes data more efficiently.", example_zh: "新软件更高效地处理数据。", example_ja: "新しいソフトウェアはデータをより効率的に処理します。", source_part: 5, difficulty: 2, cefr_level: "B1", score_band: "600-700" },
  { term: "eligible", pos: "adj", definition_en: "satisfying the conditions to participate", definition_zh: "有资格的，合格的", definition_ja: "資格のある、適格な", example_en: "Employees with over one year of service are eligible for the bonus.", example_zh: "服务年限超过一年的员工有资格获得奖金。", example_ja: "1年以上勤続した従業員はボーナスを受け取る資格があります。", source_part: 6, difficulty: 3, cefr_level: "B2", score_band: "700-800" },
  { term: "estimate", pos: "v/n", definition_en: "to roughly calculate or judge the value of", definition_zh: "估计，预估", definition_ja: "見積もる、推定する", example_en: "Please provide an estimate of the project cost.", example_zh: "请提供项目费用估算。", example_ja: "プロジェクトコストの見積もりを提出してください。", source_part: 7, difficulty: 2, cefr_level: "B1", score_band: "600-700" },
  { term: "evaluation", pos: "n", definition_en: "the making of a judgment about value or quality", definition_zh: "评估，评价", definition_ja: "評価", example_en: "Annual evaluations help track employee performance.", example_zh: "年度评估有助于跟踪员工绩效。", example_ja: "年次評価は従業員の業績を追跡するのに役立ちます。", source_part: 7, difficulty: 3, cefr_level: "B2", score_band: "700-800" },
  { term: "expansion", pos: "n", definition_en: "the process of becoming larger or more extensive", definition_zh: "扩张，扩展", definition_ja: "拡大、拡張", example_en: "The company announced plans for international expansion.", example_zh: "该公司宣布了国际扩张计划。", example_ja: "同社は国際展開の計画を発表しました。", source_part: 7, difficulty: 3, cefr_level: "B2", score_band: "700-800" },
  { term: "facilitate", pos: "v", definition_en: "to make an action or process easier", definition_zh: "促进，使便利", definition_ja: "促進する、容易にする", example_en: "Technology facilitates communication between remote teams.", example_zh: "技术促进了远程团队之间的沟通。", example_ja: "テクノロジーはリモートチーム間のコミュニケーションを促進します。", source_part: 5, difficulty: 4, cefr_level: "C1", score_band: "800-900" },
  { term: "fluctuate", pos: "v", definition_en: "to rise and fall irregularly in number or amount", definition_zh: "波动", definition_ja: "変動する", example_en: "Currency exchange rates fluctuate daily.", example_zh: "货币汇率每天都在波动。", example_ja: "通貨の為替レートは毎日変動します。", source_part: 7, difficulty: 4, cefr_level: "C1", score_band: "800-900" },
  { term: "headquarters", pos: "n", definition_en: "the main offices of an organization", definition_zh: "总部", definition_ja: "本社、本部", example_en: "The company's headquarters is located in Tokyo.", example_zh: "公司总部位于东京。", example_ja: "同社の本社は東京にあります。", source_part: 4, difficulty: 2, cefr_level: "B1", score_band: "600-700" },
  { term: "implement", pos: "v", definition_en: "to put a plan or decision into effect", definition_zh: "实施，执行", definition_ja: "実施する、導入する", example_en: "The team will implement the new policy next month.", example_zh: "团队将于下月实施新政策。", example_ja: "チームは来月、新しい方針を実施します。", source_part: 5, difficulty: 3, cefr_level: "B2", score_band: "700-800" },
  { term: "initiative", pos: "n", definition_en: "a new plan or process to achieve a goal", definition_zh: "倡议，主动性", definition_ja: "イニシアティブ、取り組み", example_en: "The company launched a sustainability initiative.", example_zh: "公司启动了一项可持续发展倡议。", example_ja: "同社は持続可能性への取り組みを開始しました。", source_part: 7, difficulty: 4, cefr_level: "C1", score_band: "800-900" },
  { term: "inventory", pos: "n", definition_en: "a complete list of stock or goods", definition_zh: "库存，存货清单", definition_ja: "在庫、棚卸し", example_en: "We need to check the inventory before placing an order.", example_zh: "我们需要在下订单之前检查库存。", example_ja: "注文する前に在庫を確認する必要があります。", source_part: 7, difficulty: 2, cefr_level: "B1", score_band: "600-700" },
  { term: "launch", pos: "v/n", definition_en: "to introduce a new product or service to the market", definition_zh: "发布，推出", definition_ja: "発売する、開始する", example_en: "The company is set to launch its new app next week.", example_zh: "公司计划下周发布新应用。", example_ja: "同社は来週、新しいアプリをリリースする予定です。", source_part: 4, difficulty: 1, cefr_level: "B1", score_band: "600-700" },
  { term: "mandatory", pos: "adj", definition_en: "required by law or rules; compulsory", definition_zh: "强制性的，义务的", definition_ja: "義務的な、必須の", example_en: "Attendance at the safety training is mandatory.", example_zh: "参加安全培训是强制性的。", example_ja: "安全訓練への参加は必須です。", source_part: 6, difficulty: 3, cefr_level: "B2", score_band: "700-800" },
  { term: "negotiate", pos: "v", definition_en: "to discuss in order to reach an agreement", definition_zh: "谈判，协商", definition_ja: "交渉する", example_en: "They negotiated a better deal with the supplier.", example_zh: "他们与供应商谈判达成了更好的协议。", example_ja: "彼らはサプライヤーとより良い取引を交渉しました。", source_part: 3, difficulty: 3, cefr_level: "B2", score_band: "700-800" },
  { term: "objective", pos: "n/adj", definition_en: "a goal, or not influenced by personal feelings", definition_zh: "目标；客观的", definition_ja: "目標；客観的な", example_en: "Our main objective is to increase customer satisfaction.", example_zh: "我们的主要目标是提高客户满意度。", example_ja: "私たちの主な目標は顧客満足度を向上させることです。", source_part: 7, difficulty: 2, cefr_level: "B1", score_band: "600-700" },
  { term: "optimize", pos: "v", definition_en: "to make the best or most effective use of", definition_zh: "优化", definition_ja: "最適化する", example_en: "We need to optimize our supply chain processes.", example_zh: "我们需要优化供应链流程。", example_ja: "サプライチェーンプロセスを最適化する必要があります。", source_part: 5, difficulty: 4, cefr_level: "C1", score_band: "800-900" },
  { term: "preliminary", pos: "adj", definition_en: "preceding or done in preparation for the main part", definition_zh: "初步的，预备的", definition_ja: "予備的な、準備段階の", example_en: "The preliminary results look very promising.", example_zh: "初步结果看起来非常有希望。", example_ja: "予備的な結果は非常に有望です。", source_part: 7, difficulty: 4, cefr_level: "C1", score_band: "800-900" },
  { term: "promote", pos: "v", definition_en: "to advance in rank or to support growth of", definition_zh: "晋升；促进，推广", definition_ja: "昇進させる；促進する", example_en: "She was promoted to regional manager last year.", example_zh: "她去年晋升为区域经理。", example_ja: "彼女は昨年、地域マネージャーに昇進しました。", source_part: 4, difficulty: 2, cefr_level: "B1", score_band: "600-700" },
  { term: "proposal", pos: "n", definition_en: "a plan or suggestion put forward for consideration", definition_zh: "提案，建议书", definition_ja: "提案書、計画書", example_en: "The sales team submitted a proposal for the new contract.", example_zh: "销售团队提交了新合同的提案。", example_ja: "営業チームは新しい契約の提案書を提出しました。", source_part: 7, difficulty: 2, cefr_level: "B1", score_band: "600-700" },
  { term: "reimburse", pos: "v", definition_en: "to repay money spent on one's behalf", definition_zh: "报销，偿还", definition_ja: "払い戻す、弁償する", example_en: "The company will reimburse your travel expenses.", example_zh: "公司将报销您的差旅费用。", example_ja: "会社はあなたの出張費を払い戻します。", source_part: 6, difficulty: 3, cefr_level: "B2", score_band: "700-800" },
  { term: "revenue", pos: "n", definition_en: "income generated from business activities", definition_zh: "收入，营业额", definition_ja: "収益、売上高", example_en: "Annual revenue grew by 15 percent this year.", example_zh: "今年年收入增长了15%。", example_ja: "今年の年間売上高は15%増加しました。", source_part: 7, difficulty: 2, cefr_level: "B2", score_band: "700-800" },
  { term: "revise", pos: "v", definition_en: "to reconsider and alter in the light of further evidence", definition_zh: "修订，修改", definition_ja: "改訂する、修正する", example_en: "Please revise the budget proposal by Monday.", example_zh: "请在周一前修改预算提案。", example_ja: "月曜日までに予算提案を修正してください。", source_part: 5, difficulty: 2, cefr_level: "B1", score_band: "600-700" },
  { term: "schedule", pos: "v/n", definition_en: "to arrange events to take place at a certain time", definition_zh: "安排，计划表", definition_ja: "スケジュールを組む、日程", example_en: "Can you schedule a meeting for Thursday afternoon?", example_zh: "您能安排周四下午开会吗？", example_ja: "木曜日の午後にミーティングをスケジュールできますか？", source_part: 3, difficulty: 1, cefr_level: "A2", score_band: "600-700" },
  { term: "signature", pos: "n", definition_en: "a person's name written as authorization", definition_zh: "签名，签字", definition_ja: "署名", example_en: "Please add your signature at the bottom of the form.", example_zh: "请在表格底部签名。", example_ja: "フォームの下部に署名を追加してください。", source_part: 6, difficulty: 1, cefr_level: "A2", score_band: "600-700" },
  { term: "simultaneously", pos: "adv", definition_en: "at the same time", definition_zh: "同时地", definition_ja: "同時に", example_en: "The two announcements were made simultaneously.", example_zh: "两项公告同时发布。", example_ja: "2つの発表は同時に行われました。", source_part: 5, difficulty: 4, cefr_level: "C1", score_band: "800-900" },
  { term: "strategy", pos: "n", definition_en: "a plan of action designed to achieve a goal", definition_zh: "战略，策略", definition_ja: "戦略", example_en: "The board approved a new growth strategy.", example_zh: "董事会批准了新的增长战略。", example_ja: "取締役会は新しい成長戦略を承認しました。", source_part: 7, difficulty: 2, cefr_level: "B1", score_band: "600-700" },
  { term: "submit", pos: "v", definition_en: "to present for consideration or judgment", definition_zh: "提交，呈交", definition_ja: "提出する", example_en: "Please submit your application by the end of the week.", example_zh: "请在本周末前提交您的申请。", example_ja: "週末までに申請書を提出してください。", source_part: 5, difficulty: 1, cefr_level: "B1", score_band: "600-700" },
  { term: "subscription", pos: "n", definition_en: "an arrangement to receive a product or service regularly", definition_zh: "订阅，订购", definition_ja: "サブスクリプション、定期購読", example_en: "A monthly subscription gives you access to all features.", example_zh: "月度订阅让您可以使用所有功能。", example_ja: "月額サブスクリプションですべての機能にアクセスできます。", source_part: 7, difficulty: 2, cefr_level: "B1", score_band: "600-700" },
  { term: "sufficient", pos: "adj", definition_en: "enough; adequate for the purpose", definition_zh: "足够的，充分的", definition_ja: "十分な", example_en: "Make sure you have sufficient time to complete the task.", example_zh: "确保您有足够的时间完成任务。", example_ja: "タスクを完了するのに十分な時間があることを確認してください。", source_part: 5, difficulty: 2, cefr_level: "B1", score_band: "600-700" },
  { term: "supervisor", pos: "n", definition_en: "a person who oversees others' work", definition_zh: "主管，监督者", definition_ja: "上司、監督者", example_en: "Please report any issues to your supervisor.", example_zh: "请向您的主管报告任何问题。", example_ja: "問題があれば上司に報告してください。", source_part: 3, difficulty: 1, cefr_level: "B1", score_band: "600-700" },
  { term: "transaction", pos: "n", definition_en: "an instance of buying or selling", definition_zh: "交易，事务", definition_ja: "取引", example_en: "All transactions must be recorded in the system.", example_zh: "所有交易必须记录在系统中。", example_ja: "すべての取引はシステムに記録される必要があります。", source_part: 7, difficulty: 3, cefr_level: "B2", score_band: "700-800" },
  { term: "transparent", pos: "adj", definition_en: "open and honest; easy to understand", definition_zh: "透明的，坦诚的", definition_ja: "透明な、わかりやすい", example_en: "The company aims to be transparent with its shareholders.", example_zh: "公司致力于对股东保持透明。", example_ja: "同社は株主に対して透明であることを目指しています。", source_part: 5, difficulty: 3, cefr_level: "B2", score_band: "700-800" },
  { term: "verify", pos: "v", definition_en: "to make sure or demonstrate something is true", definition_zh: "核实，验证", definition_ja: "確認する、検証する", example_en: "Please verify your email address to complete registration.", example_zh: "请验证您的电子邮件地址以完成注册。", example_ja: "登録を完了するためにメールアドレスを確認してください。", source_part: 5, difficulty: 2, cefr_level: "B1", score_band: "600-700" },
  { term: "warranty", pos: "n", definition_en: "a written guarantee promising repair or replacement", definition_zh: "保修，质保", definition_ja: "保証", example_en: "The product comes with a two-year warranty.", example_zh: "该产品附有两年质保。", example_ja: "製品には2年間の保証が付いています。", source_part: 7, difficulty: 2, cefr_level: "B1", score_band: "600-700" },
];

// ── Database seeding ──────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const { DATABASE_URL, SEED_TENANT_ID, SEED_USER_ID } = process.env;

  if (!DATABASE_URL) {
    console.log("DATABASE_URL not set — dry-run mode. Generated cards:");
    for (const card of TRILINGUAL_CARDS) {
      console.log(
        `  [${card.score_band}] ${card.term} (${card.pos}): ${card.definition_zh} / ${card.definition_ja}`,
      );
    }
    console.log(`\nTotal: ${TRILINGUAL_CARDS.length} cards`);
    return;
  }

  // Dynamic import so the module works without pg installed in CI
  const { default: pg } = await import("pg");
  const client = new pg.Client({ connectionString: DATABASE_URL });
  await client.connect();

  try {
    // Resolve or create demo tenant
    let tenantId = SEED_TENANT_ID;
    if (!tenantId) {
      const result = await client.query<{ id: string }>(
        `INSERT INTO tenants (name, code) VALUES ('Demo Tenant', 'demo')
         ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
         RETURNING id`,
      );
      tenantId = result.rows[0].id;
      console.log(`Tenant: ${tenantId}`);
    }

    // Resolve or create seed user
    let userId = SEED_USER_ID;
    if (!userId) {
      const result = await client.query<{ id: string }>(
        `INSERT INTO users (email, display_name, password_hash)
         VALUES ('seed@demo.com', 'Seed User', '')
         ON CONFLICT (email) DO UPDATE SET display_name = EXCLUDED.display_name
         RETURNING id`,
      );
      userId = result.rows[0].id;
      console.log(`User: ${userId}`);
    }

    const today = new Date().toISOString().slice(0, 10);
    let inserted = 0;
    let skipped = 0;

    for (const card of TRILINGUAL_CARDS) {
      const meta = JSON.stringify({
        definition_zh: card.definition_zh,
        definition_ja: card.definition_ja,
        example_zh: card.example_zh,
        example_ja: card.example_ja,
      });

      const result = await client.query(
        `INSERT INTO vocabulary_cards (
           tenant_id, user_id, term, pos, definition, example,
           source_part, tags, ease_factor, interval_days, due_at,
           cefr_level, difficulty, score_band
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,2.30,0,$9,$10,$11,$12)
         ON CONFLICT (tenant_id, user_id, term, pos) DO NOTHING`,
        [
          tenantId,
          userId,
          card.term,
          card.pos,
          `${card.definition_en} [meta:${meta}]`,
          card.example_en,
          card.source_part,
          ["trilingual", "seed"],
          today,
          card.cefr_level,
          card.difficulty,
          card.score_band,
        ],
      );

      if ((result.rowCount ?? 0) > 0) {
        inserted += 1;
      } else {
        skipped += 1;
      }
    }

    console.log(`Seed complete: ${inserted} inserted, ${skipped} skipped (already exist).`);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
