/**
 * Static news articles for shadowing practice.
 * Used as fallback when the live /api/news endpoint is unavailable.
 */

export type NewsMaterial = {
  id: string;
  title: string;
  titleCn: string;
  source: string;
  date: string;
  difficulty: number;
  sentences: Array<{ id: number; text: string; translation: string }>;
};

export function getDailyNews(): NewsMaterial[] {
  const today = new Date().toLocaleDateString();
  return [
    {
      id: "news-tech-ai",
      title: "AI Technology Transforms Global Workforce",
      titleCn: "AI技术改变全球劳动力市场",
      source: "Tech News Daily",
      date: today,
      difficulty: 2,
      sentences: [
        { id: 1, text: "Artificial intelligence is rapidly transforming the way companies operate across every industry.", translation: "人工智能正在迅速改变各行业公司的运营方式。" },
        { id: 2, text: "Many businesses are investing heavily in AI tools to improve efficiency and reduce costs.", translation: "许多企业正在大力投资AI工具以提高效率和降低成本。" },
        { id: 3, text: "Workers are being encouraged to develop new skills to adapt to the changing job market.", translation: "工人们被鼓励培养新技能以适应不断变化的就业市场。" },
        { id: 4, text: "Experts predict that AI will create more jobs than it eliminates in the long run.", translation: "专家预测，从长远来看，AI创造的就业机会将多于其消除的。" },
        { id: 5, text: "The demand for data scientists and machine learning engineers has increased significantly.", translation: "对数据科学家和机器学习工程师的需求显著增加。" },
        { id: 6, text: "Companies that fail to adopt AI technology risk falling behind their competitors.", translation: "未能采用AI技术的公司面临落后于竞争对手的风险。" },
        { id: 7, text: "Governments around the world are developing regulations to ensure AI is used responsibly.", translation: "世界各国政府正在制定法规以确保AI的负责任使用。" },
        { id: 8, text: "The healthcare industry has seen remarkable improvements thanks to AI-powered diagnostics.", translation: "由于AI驱动的诊断技术，医疗行业取得了显著的改进。" },
        { id: 9, text: "Education systems are integrating AI to provide personalized learning experiences for students.", translation: "教育系统正在整合AI，为学生提供个性化的学习体验。" },
        { id: 10, text: "The future of work will require a balance between human creativity and artificial intelligence.", translation: "未来的工作将需要在人类创造力和人工智能之间取得平衡。" },
      ],
    },
    {
      id: "news-climate",
      title: "Global Climate Summit Reaches Historic Agreement",
      titleCn: "全球气候峰会达成历史性协议",
      source: "World News",
      date: today,
      difficulty: 2,
      sentences: [
        { id: 1, text: "World leaders have reached a landmark agreement to reduce carbon emissions by fifty percent by 2035.", translation: "世界各国领导人达成了一项里程碑式的协议，到2035年将碳排放减少百分之五十。" },
        { id: 2, text: "The agreement includes commitments from both developed and developing nations.", translation: "该协议包括发达国家和发展中国家的承诺。" },
        { id: 3, text: "Renewable energy investments are expected to double over the next decade.", translation: "可再生能源投资预计在未来十年内翻倍。" },
        { id: 4, text: "Environmental groups have praised the agreement but say more action is needed.", translation: "环保团体赞扬了该协议，但表示需要更多行动。" },
        { id: 5, text: "Scientists warn that time is running out to prevent the worst effects of climate change.", translation: "科学家警告说，防止气候变化最严重影响的时间已所剩无几。" },
        { id: 6, text: "Electric vehicle adoption has accelerated as more countries ban fossil fuel cars.", translation: "随着更多国家禁止化石燃料汽车，电动汽车的采用正在加速。" },
        { id: 7, text: "The transition to clean energy is creating millions of new green jobs worldwide.", translation: "向清洁能源的转型正在全球创造数百万个新的绿色就业机会。" },
        { id: 8, text: "Rising sea levels continue to threaten coastal communities around the globe.", translation: "不断上升的海平面继续威胁着全球沿海社区。" },
        { id: 9, text: "Public awareness of environmental issues has grown dramatically in recent years.", translation: "近年来，公众对环境问题的意识大幅提高。" },
        { id: 10, text: "Businesses are increasingly adopting sustainable practices to meet consumer demand.", translation: "企业正越来越多地采用可持续做法来满足消费者需求。" },
      ],
    },
    {
      id: "news-economy",
      title: "Global Economy Shows Signs of Recovery",
      titleCn: "全球经济显示复苏迹象",
      source: "Financial Times",
      date: today,
      difficulty: 3,
      sentences: [
        { id: 1, text: "The global economy is showing strong signs of recovery after years of uncertainty.", translation: "经过多年的不确定性后，全球经济正显示出强劲的复苏迹象。" },
        { id: 2, text: "Consumer spending has increased across major economies, boosting retail sales.", translation: "主要经济体的消费者支出增加，推动了零售销售。" },
        { id: 3, text: "Central banks are carefully considering whether to adjust interest rates.", translation: "各国央行正在仔细考虑是否调整利率。" },
        { id: 4, text: "The unemployment rate has dropped to its lowest level in over a decade.", translation: "失业率已降至十多年来的最低水平。" },
        { id: 5, text: "Supply chain disruptions that plagued manufacturers are finally easing.", translation: "困扰制造商的供应链中断问题终于得到缓解。" },
        { id: 6, text: "International trade volumes have returned to pre-pandemic levels.", translation: "国际贸易量已恢复到疫情前的水平。" },
        { id: 7, text: "Inflation remains a concern for policymakers despite recent improvements.", translation: "尽管近期有所改善，通货膨胀仍是政策制定者关注的问题。" },
        { id: 8, text: "Small businesses are reporting increased optimism about future growth prospects.", translation: "小企业对未来增长前景的乐观情绪有所增加。" },
        { id: 9, text: "The housing market continues to be a key indicator of economic health.", translation: "房地产市场继续是经济健康状况的关键指标。" },
        { id: 10, text: "Economists forecast steady growth for the remainder of the fiscal year.", translation: "经济学家预测本财年剩余时间将保持稳定增长。" },
      ],
    },
    {
      id: "news-health",
      title: "New Breakthrough in Medical Research",
      titleCn: "医学研究新突破",
      source: "Health Science Weekly",
      date: today,
      difficulty: 2,
      sentences: [
        { id: 1, text: "Researchers have announced a major breakthrough in cancer treatment using immunotherapy.", translation: "研究人员宣布了使用免疫疗法治疗癌症的重大突破。" },
        { id: 2, text: "Clinical trials show that the new treatment is effective for a wide range of cancers.", translation: "临床试验表明，新疗法对多种癌症有效。" },
        { id: 3, text: "The development of this treatment has been decades in the making.", translation: "这种治疗方法的开发已历经数十年。" },
        { id: 4, text: "Patients who participated in the trial reported fewer side effects than traditional chemotherapy.", translation: "参加试验的患者报告的副作用比传统化疗少。" },
        { id: 5, text: "The World Health Organization has called this a significant step forward in global health.", translation: "世界卫生组织称这是全球健康领域的重大进步。" },
        { id: 6, text: "Pharmaceutical companies are racing to bring the treatment to market as soon as possible.", translation: "制药公司正竞相尽快将该疗法推向市场。" },
        { id: 7, text: "Mental health awareness has also increased, with more resources being allocated to support services.", translation: "心理健康意识也有所提高，更多资源被分配到支持服务中。" },
        { id: 8, text: "Telemedicine has become a permanent part of healthcare delivery in many countries.", translation: "远程医疗已成为许多国家医疗服务的永久组成部分。" },
        { id: 9, text: "Regular exercise and a balanced diet remain the foundation of good health.", translation: "规律运动和均衡饮食仍然是良好健康的基础。" },
        { id: 10, text: "Access to affordable healthcare remains a critical challenge in developing nations.", translation: "在发展中国家，获得负担得起的医疗保健仍然是一个关键挑战。" },
      ],
    },
    {
      id: "news-space",
      title: "New Space Mission to Mars Announced",
      titleCn: "新火星探测任务宣布",
      source: "Space & Science",
      date: today,
      difficulty: 2,
      sentences: [
        { id: 1, text: "NASA has announced plans for a new manned mission to Mars scheduled for 2030.", translation: "NASA宣布了计划于2030年进行新的载人火星任务。" },
        { id: 2, text: "The mission will be the first to attempt landing humans on another planet.", translation: "该任务将是首次尝试将人类降落在另一个星球上。" },
        { id: 3, text: "International cooperation will be essential for the success of this ambitious project.", translation: "国际合作对于这个雄心勃勃的项目的成功至关重要。" },
        { id: 4, text: "Advanced life support systems are being developed to sustain astronauts during the long journey.", translation: "先进的生命维持系统正在开发中，以维持宇航员在漫长旅途中的生存。" },
        { id: 5, text: "Private space companies are playing an increasingly important role in space exploration.", translation: "私人太空公司在太空探索中扮演着越来越重要的角色。" },
        { id: 6, text: "The journey to Mars is expected to take approximately seven months.", translation: "前往火星的旅程预计需要大约七个月。" },
        { id: 7, text: "Scientists hope to discover signs of past or present life on the red planet.", translation: "科学家们希望在这颗红色星球上发现过去或现在生命的迹象。" },
        { id: 8, text: "Space tourism is becoming a reality as costs continue to decrease.", translation: "随着成本持续下降，太空旅游正在成为现实。" },
        { id: 9, text: "The technology developed for space missions often leads to innovations on Earth.", translation: "为太空任务开发的技术通常会带来地球上的创新。" },
        { id: 10, text: "Funding for space research has received broad bipartisan support.", translation: "太空研究的资金获得了广泛的两党支持。" },
      ],
    },
  ];
}

export function getDailyNewsJa(): NewsMaterial[] {
  const today = new Date().toLocaleDateString();
  return [
    {
      id: "news-ja-tech",
      title: "AI技術が日本の職場を変革",
      titleCn: "AI技术变革日本职场",
      source: "NHK ニュース",
      date: today,
      difficulty: 2,
      sentences: [
        { id: 1, text: "人工知能の急速な発展により、日本の多くの企業が業務の自動化を進めています。", translation: "随着人工智能的快速发展，日本许多企业正在推进业务自动化。" },
        { id: 2, text: "特にカスタマーサービスや製造業での導入が加速しています。", translation: "特别是客户服务和制造业的导入正在加速。" },
        { id: 3, text: "政府はAI人材の育成に力を入れる方針を示しました。", translation: "政府表示将致力于培养AI人才。" },
        { id: 4, text: "一方で、雇用への影響を懸念する声も上がっています。", translation: "另一方面，也有人担忧对就业的影响。" },
        { id: 5, text: "専門家は、AIと共存するためのスキルアップが重要だと指摘しています。", translation: "专家指出，提升与AI共存的技能非常重要。" },
        { id: 6, text: "教育現場でもプログラミング教育の充実が求められています。", translation: "教育领域也要求充实编程教育。" },
        { id: 7, text: "AI技術の倫理的な利用についても議論が活発化しています。", translation: "关于AI技术的伦理使用，讨论也日趋活跃。" },
        { id: 8, text: "医療分野では、AI診断の精度が大幅に向上しました。", translation: "在医疗领域，AI诊断的精度大幅提升。" },
        { id: 9, text: "今後もAI技術の進化に合わせた社会制度の整備が必要です。", translation: "今后也需要配合AI技术进化来完善社会制度。" },
        { id: 10, text: "産業界と学術界の連携がますます重要になっています。", translation: "产学合作变得越来越重要。" },
      ],
    },
    {
      id: "news-ja-society",
      title: "高齢化社会と地域コミュニティの再構築",
      titleCn: "老龄化社会与地域社区的重建",
      source: "NHK 社会",
      date: today,
      difficulty: 2,
      sentences: [
        { id: 1, text: "日本の高齢化率が過去最高を更新し、社会全体での対応が急務となっています。", translation: "日本老龄化率创历史新高，全社会的应对已迫在眉睫。" },
        { id: 2, text: "地方では空き家問題が深刻化し、コミュニティの維持が課題です。", translation: "地方空房问题日益严重，维系社区成为课题。" },
        { id: 3, text: "自治体は移住促進策やテレワーク支援を進めています。", translation: "地方政府正在推进促进移居和远程办公支持政策。" },
        { id: 4, text: "高齢者の社会参加を促すボランティア活動が広がっています。", translation: "促进高龄者参与社会的志愿者活动正在扩大。" },
        { id: 5, text: "介護ロボットの導入により、介護現場の負担軽減が期待されています。", translation: "引入护理机器人有望减轻护理现场的负担。" },
        { id: 6, text: "子育て世代への支援も同時に強化する必要があります。", translation: "同时也需要加强对育儿一代的支援。" },
        { id: 7, text: "多世代交流の場を設ける取り組みが注目されています。", translation: "设立多代交流场所的举措备受关注。" },
        { id: 8, text: "デジタル技術を活用した見守りサービスが普及し始めています。", translation: "利用数字技术的守望服务开始普及。" },
        { id: 9, text: "健康寿命の延伸が国の重要な政策課題となっています。", translation: "延长健康寿命已成为国家重要政策课题。" },
        { id: 10, text: "地域の絆を取り戻すための新しい仕組みづくりが求められています。", translation: "人们正在寻求重建地域纽带的新机制。" },
      ],
    },
    {
      id: "news-ja-culture",
      title: "日本の伝統文化とグローバル発信",
      titleCn: "日本传统文化的全球传播",
      source: "NHK 文化",
      date: today,
      difficulty: 1,
      sentences: [
        { id: 1, text: "日本のアニメや漫画は世界中で高い人気を誇っています。", translation: "日本动漫和漫画在全世界都享有很高人气。" },
        { id: 2, text: "和食がユネスコ無形文化遺産に登録されてから、海外での関心がさらに高まりました。", translation: "和食被列入联合国教科文组织非物质文化遗产后，海外的关注进一步提高。" },
        { id: 3, text: "茶道や生け花など、伝統的な文化体験を求める外国人観光客が増えています。", translation: "越来越多的外国游客寻求茶道和花道等传统文化体验。" },
        { id: 4, text: "日本語学習者の数は年々増加しており、その動機の多くはポップカルチャーです。", translation: "日语学习者人数逐年增加，其动机多为流行文化。" },
        { id: 5, text: "伝統工芸の後継者不足が深刻な問題となっています。", translation: "传统工艺后继者不足已成为严重问题。" },
        { id: 6, text: "若い世代が伝統文化をSNSで発信する動きも活発です。", translation: "年轻一代通过社交媒体传播传统文化的活动也很活跃。" },
        { id: 7, text: "地方の祭りや行事を国際的にPRする自治体が増えています。", translation: "越来越多的地方政府在国际上宣传当地的节日和活动。" },
        { id: 8, text: "文化庁はクールジャパン戦略として海外展開を支援しています。", translation: "文化厅作为酷日本战略支持海外拓展。" },
        { id: 9, text: "日本のおもてなし精神は海外からも高く評価されています。", translation: "日本的待客之道在海外也获得高度评价。" },
        { id: 10, text: "伝統と革新の融合が新しい日本文化を生み出しています。", translation: "传统与革新的融合正在创造新的日本文化。" },
      ],
    },
    {
      id: "news-ja-business",
      title: "日本企業のグローバル展開最新動向",
      titleCn: "日本企业全球化最新动向",
      source: "NHK ビジネス",
      date: today,
      difficulty: 3,
      sentences: [
        { id: 1, text: "円安の影響で日本の輸出企業の業績が好調です。", translation: "受日元贬值影响，日本出口企业业绩良好。" },
        { id: 2, text: "半導体産業への大規模投資が国家戦略として進められています。", translation: "对半导体产业的大规模投资正作为国家战略推进。" },
        { id: 3, text: "スタートアップ企業の育成に向けた支援制度が拡充されています。", translation: "培育初创企业的支援制度正在扩充。" },
        { id: 4, text: "リモートワークの定着により、オフィス需要に変化が見られます。", translation: "随着远程办公的普及，办公需求出现变化。" },
        { id: 5, text: "サステナビリティ経営が企業価値を左右する時代になりました。", translation: "可持续经营已成为左右企业价值的时代。" },
        { id: 6, text: "人手不足を背景に、外国人労働者の受け入れが拡大しています。", translation: "以劳动力短缺为背景，接受外国劳动者正在扩大。" },
        { id: 7, text: "デジタルトランスフォーメーションが中小企業にも浸透し始めています。", translation: "数字化转型也开始渗透到中小企业。" },
        { id: 8, text: "物流業界では二〇二四年問題への対応が急がれています。", translation: "物流行业正在紧急应对2024年问题。" },
        { id: 9, text: "ESG投資の拡大により、環境に配慮した経営が求められています。", translation: "随着ESG投资的扩大，企业被要求注重环境的经营。" },
        { id: 10, text: "国際的な競争力を強化するため、産学官の連携が不可欠です。", translation: "为强化国际竞争力，产学官合作不可或缺。" },
      ],
    },
  ];
}
