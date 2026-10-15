export type ShadowingTranslations = Partial<Record<"zh" | "ja" | "en", string>>;

export type ShadowingMaterial = {
  id: string;
  title: string;
  translations: ShadowingTranslations;
  source: string;
  category: "speech" | "drama" | "ted";
  difficulty: 1 | 2 | 3;
  youtubeVideoId?: string;
  sentences: ShadowingSentence[];
};

export type ShadowingSentence = {
  id: number;
  text: string;
  translations: ShadowingTranslations;
  startSec?: number;
  endSec?: number;
};

type ShadowingMaterialInput = Omit<ShadowingMaterial, "translations" | "sentences"> & {
  titleCn?: string;
  translations?: ShadowingTranslations;
  sentences: Array<
    Omit<ShadowingSentence, "translations"> & {
      translation?: string;
      translationEn?: string;
      translations?: ShadowingTranslations;
    }
  >;
};

function normalizeTranslationValue(value: unknown): string | undefined {
  const text = String(value ?? "").trim();
  return text.length > 0 ? text : undefined;
}

function normalizeShadowingTranslations(
  translations?: ShadowingTranslations,
  legacyZh?: unknown,
  legacyEn?: unknown,
): ShadowingTranslations {
  return {
    ...(normalizeTranslationValue(translations?.zh ?? legacyZh) ? { zh: normalizeTranslationValue(translations?.zh ?? legacyZh) } : {}),
    ...(normalizeTranslationValue(translations?.ja) ? { ja: normalizeTranslationValue(translations?.ja) } : {}),
    ...(normalizeTranslationValue(translations?.en ?? legacyEn) ? { en: normalizeTranslationValue(translations?.en ?? legacyEn) } : {}),
  };
}

export function defineShadowingMaterials(materials: ShadowingMaterialInput[]): ShadowingMaterial[] {
  return materials.map((material) => ({
    id: material.id,
    title: material.title,
    translations: normalizeShadowingTranslations(material.translations, material.titleCn),
    source: material.source,
    category: material.category,
    difficulty: material.difficulty,
    ...(material.youtubeVideoId ? { youtubeVideoId: material.youtubeVideoId } : {}),
    sentences: material.sentences.map((sentence) => ({
      id: sentence.id,
      text: sentence.text,
      translations: normalizeShadowingTranslations(sentence.translations, sentence.translation, sentence.translationEn),
      ...(typeof sentence.startSec === "number" ? { startSec: sentence.startSec } : {}),
      ...(typeof sentence.endSec === "number" ? { endSec: sentence.endSec } : {}),
    })),
  }));
}

export const SHADOWING_MATERIALS: ShadowingMaterial[] = defineShadowingMaterials([
  {
    id: "business-english",
    title: "Business English - Key Phrases",
    titleCn: "商务英语 - 关键短语",
    source: "TOEIC Practice",
    category: "speech",
    difficulty: 2,
    sentences: [
      { id: 1, text: "I'd like to schedule a conference call for next Monday at ten AM.", translation: "我想安排下周一上午十点的电话会议。" },
      { id: 2, text: "Could you please forward the meeting minutes to all attendees?", translation: "你能把会议纪要转发给所有与会者吗？" },
      { id: 3, text: "We need to address the concerns raised by our stakeholders.", translation: "我们需要处理利益相关者提出的问题。" },
      { id: 4, text: "The revenue for this quarter exceeded our expectations by fifteen percent.", translation: "本季度的收入超出了我们预期的百分之十五。" },
      { id: 5, text: "I recommend that we conduct a thorough market analysis before making a decision.", translation: "我建议在做决定之前进行全面的市场分析。" },
      { id: 6, text: "The annual performance review will take place at the end of December.", translation: "年度绩效评估将在十二月底进行。" },
      { id: 7, text: "Please ensure that all invoices are submitted before the billing deadline.", translation: "请确保所有发票在账单截止日期前提交。" },
      { id: 8, text: "We are pleased to announce the opening of our new branch in Singapore.", translation: "我们很高兴宣布新加坡新分公司的开业。" },
      { id: 9, text: "The board of directors has approved the merger with the parent company.", translation: "董事会已批准与母公司的合并。" },
      { id: 10, text: "Due to unforeseen circumstances, the product launch has been postponed.", translation: "由于不可预见的情况，产品发布已被推迟。" },
      { id: 11, text: "All employees are required to complete the compliance training by the end of the month.", translation: "所有员工必须在月底前完成合规培训。" },
      { id: 12, text: "We appreciate your continued support and look forward to a successful partnership.", translation: "我们感谢您的持续支持，并期待一个成功的合作伙伴关系。" },
      { id: 13, text: "The human resources department will be conducting interviews throughout next week.", translation: "人力资源部将在下周进行面试。" },
      { id: 14, text: "We need to streamline our operations to improve overall efficiency.", translation: "我们需要精简运营以提高整体效率。" },
      { id: 15, text: "The quarterly earnings report will be released to shareholders on Friday.", translation: "季度收益报告将于周五向股东发布。" },
      { id: 16, text: "Please confirm your attendance at the annual company retreat by end of this week.", translation: "请在本周末前确认您是否参加年度公司团建活动。" },
      { id: 17, text: "I would like to request a leave of absence for the first two weeks of August.", translation: "我想申请八月前两周的休假。" },
      { id: 18, text: "The contract has been reviewed by our legal department and is ready for your signature.", translation: "合同已经过我们法务部门审核，可以供您签署了。" },
      { id: 19, text: "We will be implementing a new customer relationship management system starting next quarter.", translation: "从下个季度开始，我们将实施新的客户关系管理系统。" },
      { id: 20, text: "The company policy requires all business trips to be approved by a direct supervisor in advance.", translation: "公司政策要求所有出差必须事先得到直属主管的批准。" },
      { id: 21, text: "I would appreciate it if you could provide a detailed cost breakdown for this project.", translation: "如果您能提供这个项目的详细成本明细，我将不胜感激。" },
      { id: 22, text: "Our competitors have recently launched a similar product at a lower price point.", translation: "我们的竞争对手最近以更低的价格推出了类似产品。" },
      { id: 23, text: "The training session on workplace safety will be held in the main auditorium at two PM.", translation: "工作场所安全培训将于下午两点在主礼堂举行。" },
      { id: 24, text: "Please be advised that the office will be closed next Monday for the national holiday.", translation: "请注意，办公室下周一因国家法定假日将关闭。" },
      { id: 25, text: "We are currently accepting applications for the position of senior project manager.", translation: "我们目前正在接受高级项目经理职位的申请。" },
      { id: 26, text: "The vendor has agreed to extend the warranty period by an additional twelve months.", translation: "供应商已同意将保修期再延长十二个月。" },
      { id: 27, text: "Could we arrange a face-to-face meeting to discuss the terms of the partnership agreement?", translation: "我们能安排一次面对面的会议来讨论合作协议的条款吗？" },
      { id: 28, text: "Our customer satisfaction survey indicates a twenty percent increase in overall satisfaction ratings.", translation: "我们的客户满意度调查显示总体满意度评分提高了百分之二十。" },
      { id: 29, text: "The deadline for submitting project proposals has been extended to the fifteenth of next month.", translation: "提交项目提案的截止日期已延至下月十五日。" },
      { id: 30, text: "I suggest we set up a weekly progress meeting to keep all team members aligned.", translation: "我建议我们设立每周进度会议，以确保所有团队成员保持一致。" },
      { id: 31, text: "The accounting department has identified a discrepancy in last month's financial statements.", translation: "会计部门在上个月的财务报表中发现了一处差异。" },
      { id: 32, text: "We need to draft a memorandum of understanding before we proceed with the joint venture.", translation: "在我们推进合资项目之前，我们需要起草一份谅解备忘录。" },
      { id: 33, text: "All departments are expected to submit their annual budget proposals by the end of October.", translation: "所有部门预计在十月底前提交年度预算提案。" },
      { id: 34, text: "The IT department will be performing system maintenance this Saturday from midnight to six AM.", translation: "IT部门将于本周六凌晨十二点到早上六点进行系统维护。" },
      { id: 35, text: "I am writing to follow up on our previous conversation regarding the supply chain issues.", translation: "我写信跟进我们之前关于供应链问题的谈话。" },
      { id: 36, text: "The management team has decided to restructure the marketing division to better serve our clients.", translation: "管理团队已决定重组市场部以更好地服务客户。" },
      { id: 37, text: "Please note that the employee handbook has been updated with new remote work guidelines.", translation: "请注意员工手册已更新，加入了新的远程办公指南。" },
      { id: 38, text: "We are committed to reducing our carbon footprint by thirty percent over the next five years.", translation: "我们承诺在未来五年内将碳排放减少百分之三十。" },
    ],
  },
  {
    id: "airport-travel",
    title: "Airport & Travel English Dialogues",
    titleCn: "机场与旅行英语对话",
    source: "Travel English Practice",
    category: "drama",
    difficulty: 1,
    sentences: [
      { id: 1, text: "Excuse me, where is the check-in counter for international flights?", translation: "请问，国际航班的值机柜台在哪里？" },
      { id: 2, text: "I'd like a window seat, please, if one is available.", translation: "如果有的话，我想要一个靠窗的座位。" },
      { id: 3, text: "How many bags are you checking in today?", translation: "您今天要托运几件行李？" },
      { id: 4, text: "I have one suitcase to check and one carry-on bag.", translation: "我有一个行李箱要托运，一个随身行李。" },
      { id: 5, text: "Your flight departs from gate B twelve at three forty-five PM.", translation: "您的航班从B12号登机口下午三点四十五分起飞。" },
      { id: 6, text: "Please have your boarding pass and passport ready for inspection.", translation: "请准备好您的登机牌和护照以供检查。" },
      { id: 7, text: "Is there a direct flight to London, or do I need to transfer?", translation: "有直飞伦敦的航班吗，还是我需要转机？" },
      { id: 8, text: "You'll have a layover in Dubai for about three hours before your connecting flight.", translation: "您将在迪拜转机，大约有三个小时的中转时间。" },
      { id: 9, text: "I'm afraid your connecting flight has been delayed by approximately two hours.", translation: "恐怕您的转机航班已延误大约两小时。" },
      { id: 10, text: "We can rebook you on the next available flight at no additional cost.", translation: "我们可以免费为您改签下一趟可用的航班。" },
      { id: 11, text: "Could you tell me where the baggage claim area is?", translation: "你能告诉我行李领取区在哪里吗？" },
      { id: 12, text: "My luggage didn't arrive. I'd like to file a missing baggage report.", translation: "我的行李没到。我想申报行李丢失。" },
      { id: 13, text: "Can you describe your luggage? What color is it and does it have any tags or markings?", translation: "您能描述一下您的行李吗？它是什么颜色的，有什么标签或标记吗？" },
      { id: 14, text: "Where can I find the currency exchange counter?", translation: "哪里可以找到货币兑换柜台？" },
      { id: 15, text: "What is the current exchange rate for US dollars to Japanese yen?", translation: "美元兑换日元的当前汇率是多少？" },
      { id: 16, text: "Is there a shuttle bus from the airport to the city center?", translation: "有从机场到市中心的班车吗？" },
      { id: 17, text: "The express train to the city center departs every fifteen minutes from the basement level.", translation: "前往市中心的快线列车每十五分钟一班，从地下层出发。" },
      { id: 18, text: "I need to declare some items at customs. Where should I go?", translation: "我需要在海关申报一些物品。我应该去哪里？" },
      { id: 19, text: "What is the purpose of your visit? Business or pleasure?", translation: "您此行的目的是什么？商务还是旅游？" },
      { id: 20, text: "How long are you planning to stay in the country?", translation: "您计划在这个国家待多久？" },
      { id: 21, text: "I'm here on a business trip. I'll be staying for about one week.", translation: "我来出差。我大约待一周。" },
      { id: 22, text: "Do you have anything to declare?", translation: "您有什么需要申报的吗？" },
      { id: 23, text: "No, I don't have anything to declare. Just personal belongings.", translation: "不，我没有什么需要申报的。只是个人物品。" },
      { id: 24, text: "Where will you be staying during your visit? Do you have a hotel reservation?", translation: "您在访问期间住在哪里？您有酒店预订吗？" },
      { id: 25, text: "Yes, I have a reservation at the Grand Hotel downtown. Here is the confirmation number.", translation: "是的，我在市中心的大酒店有预订。这是确认号。" },
      { id: 26, text: "Attention passengers: flight seven twenty-three to Tokyo is now boarding at gate fourteen.", translation: "旅客请注意：飞往东京的七二三号航班现在在十四号登机口登机。" },
      { id: 27, text: "We will be boarding in three groups. Please wait until your group number is called.", translation: "我们将分三组登机。请等到您的组号被叫到。" },
      { id: 28, text: "Would you like to upgrade to business class? We have seats available.", translation: "您想升级到商务舱吗？我们有空位。" },
      { id: 29, text: "How much would the upgrade cost? Is it available for the return flight as well?", translation: "升舱费用是多少？回程航班也能升级吗？" },
      { id: 30, text: "Please fasten your seatbelt and make sure your tray table is in the upright position.", translation: "请系好安全带，确保您的小桌板处于收起位置。" },
      { id: 31, text: "Ladies and gentlemen, we are now beginning our descent. Please return to your seats.", translation: "女士们先生们，我们现在开始下降。请回到您的座位。" },
      { id: 32, text: "The local time is two fifteen PM, and the temperature outside is twenty-three degrees Celsius.", translation: "当地时间是下午两点十五分，室外温度是摄氏二十三度。" },
      { id: 33, text: "We apologize for the delay. We will begin boarding shortly.", translation: "我们为延误表示歉意。我们将很快开始登机。" },
      { id: 34, text: "Excuse me, is there a power outlet near my seat? I need to charge my phone.", translation: "请问，我座位附近有电源插座吗？我需要给手机充电。" },
      { id: 35, text: "Could I have a glass of water and a blanket, please? It's quite cold in the cabin.", translation: "能给我一杯水和一条毯子吗？机舱里很冷。" },
      { id: 36, text: "Can I get a transit visa, or do I need to stay in the international area?", translation: "我能拿到过境签证吗，还是我需要留在国际区域？" },
      { id: 37, text: "The duty-free shop is located past the security checkpoint on the left.", translation: "免税店位于过了安检之后的左边。" },
      { id: 38, text: "Is there a lounge I can use during my layover? I have a long wait.", translation: "中转期间有我可以使用的贵宾室吗？我要等很久。" },
      { id: 39, text: "I'd like to rent a car at the airport. Do you have any compact vehicles available?", translation: "我想在机场租一辆车。你们有小型车可租吗？" },
      { id: 40, text: "Please make sure all electronic devices are switched to airplane mode before takeoff.", translation: "请确保所有电子设备在起飞前切换到飞行模式。" },
      { id: 41, text: "Excuse me, I think I'm in the wrong terminal. Which terminal is for domestic flights?", translation: "请问，我好像走错航站楼了。国内航班在哪个航站楼？" },
      { id: 42, text: "Thank you for flying with us today. We hope you had a pleasant journey.", translation: "感谢您今天搭乘我们的航班。希望您旅途愉快。" },
    ],
  },
  {
    id: "hotel-checkin",
    title: "Hotel Check-in & Service Dialogues",
    titleCn: "酒店入住与服务对话",
    source: "Hospitality English Practice",
    category: "drama",
    difficulty: 1,
    sentences: [
      { id: 1, text: "Good evening. I have a reservation under the name Johnson.", translation: "晚上好。我有一个以Johnson名字预订的房间。" },
      { id: 2, text: "Welcome to our hotel. May I see your identification, please?", translation: "欢迎来到我们的酒店。请出示您的身份证件好吗？" },
      { id: 3, text: "You've been booked into a deluxe room on the eighth floor.", translation: "您被安排在八楼的豪华房间。" },
      { id: 4, text: "Would you prefer a room with a city view or a garden view?", translation: "您想要一间城景房还是花园景观房？" },
      { id: 5, text: "Here is your room key. The elevator is at the end of the hallway on your right.", translation: "这是您的房卡。电梯在走廊尽头右边。" },
      { id: 6, text: "Your room comes with complimentary Wi-Fi. The password is printed on the card holder.", translation: "您的房间包含免费Wi-Fi。密码印在卡套上。" },
      { id: 7, text: "What time is breakfast served in the morning?", translation: "早餐是早上几点供应？" },
      { id: 8, text: "Breakfast is served from six thirty to ten AM in the restaurant on the ground floor.", translation: "早餐在一楼餐厅从早上六点半供应到十点。" },
      { id: 9, text: "We also offer room service around the clock. The menu is in the folder on your desk.", translation: "我们还提供全天候客房服务。菜单在您桌上的文件夹里。" },
      { id: 10, text: "Is there a fitness center or swimming pool in the hotel?", translation: "酒店里有健身中心或游泳池吗？" },
      { id: 11, text: "Yes, the fitness center is on the third floor and the pool is on the rooftop.", translation: "有的，健身中心在三楼，游泳池在楼顶。" },
      { id: 12, text: "The pool is open from seven AM to nine PM. Towels are provided at the poolside.", translation: "泳池开放时间为早上七点到晚上九点。泳池边提供毛巾。" },
      { id: 13, text: "Could I get some extra towels sent to my room, please?", translation: "能帮我送一些额外的毛巾到房间吗？" },
      { id: 14, text: "Of course. I'll have housekeeping bring them up right away.", translation: "当然可以。我马上让客房服务部送上去。" },
      { id: 15, text: "The air conditioning in my room doesn't seem to be working properly.", translation: "我房间的空调好像不太正常。" },
      { id: 16, text: "I apologize for the inconvenience. I'll send someone from maintenance immediately.", translation: "对于给您带来的不便，我深感抱歉。我会立刻派维修人员过去。" },
      { id: 17, text: "Would you like us to move you to a different room while the issue is being fixed?", translation: "在问题修复期间，您想让我们给您换一间房吗？" },
      { id: 18, text: "I'd like to request a late checkout, if possible.", translation: "如果可以的话，我想申请延迟退房。" },
      { id: 19, text: "We can extend your checkout time until two PM for an additional charge of thirty dollars.", translation: "我们可以将您的退房时间延长到下午两点，额外收费三十美元。" },
      { id: 20, text: "Could you recommend a good restaurant nearby?", translation: "你能推荐附近一家好的餐厅吗？" },
      { id: 21, text: "There is an excellent Italian restaurant just two blocks from here.", translation: "这附近两个街区有一家很棒的意大利餐厅。" },
      { id: 22, text: "Would you like me to make a reservation for you? How many guests will there be?", translation: "您需要我帮您预订吗？一共有几位客人？" },
      { id: 23, text: "I need to arrange airport transportation for tomorrow morning at six AM.", translation: "我需要安排明天早上六点的机场接送服务。" },
      { id: 24, text: "We offer a complimentary shuttle to the airport. I'll schedule it for you.", translation: "我们提供免费的机场班车。我会帮您预约。" },
      { id: 25, text: "The shuttle will pick you up at the main entrance. Please be there five minutes early.", translation: "班车将在正门接您。请提前五分钟到达。" },
      { id: 26, text: "I'd like to check out now. Can I have my bill, please?", translation: "我现在想退房。能给我账单吗？" },
      { id: 27, text: "Your total comes to four hundred and fifty dollars, including the minibar charges and room service.", translation: "您的总费用是四百五十美元，包括迷你吧和客房服务的费用。" },
      { id: 28, text: "I don't think I used the minibar. Could you please double-check those charges?", translation: "我不认为我用了迷你吧。您能再核实一下那些费用吗？" },
      { id: 29, text: "You're right. I apologize for the error. I've removed those charges from your bill.", translation: "您说得对。对于这个错误我很抱歉。我已经从您的账单中删除了那些费用。" },
      { id: 30, text: "Thank you for staying with us. We hope you enjoyed your visit and look forward to seeing you again.", translation: "感谢您的入住。希望您度过了愉快的时光，期待您再次光临。" },
      { id: 31, text: "Do you offer laundry service? I need these clothes cleaned by tomorrow.", translation: "你们提供洗衣服务吗？我需要这些衣服在明天之前洗好。" },
      { id: 32, text: "Yes, if you leave the clothes in the laundry bag before noon, they will be ready by eight PM.", translation: "是的，如果您在中午前将衣服放入洗衣袋，晚上八点前就能洗好。" },
      { id: 33, text: "Is there a safe in the room where I can store my valuables?", translation: "房间里有保险箱可以存放贵重物品吗？" },
      { id: 34, text: "Yes, there's an electronic safe inside the wardrobe. You can set your own four-digit code.", translation: "有的，衣柜里有一个电子保险箱。您可以设置自己的四位数密码。" },
      { id: 35, text: "I'd like to book a conference room for a meeting with ten participants.", translation: "我想预订一间会议室，用于十人参加的会议。" },
      { id: 36, text: "We have a meeting room available on the second floor. It includes a projector and whiteboard.", translation: "我们在二楼有一间可用的会议室。配有投影仪和白板。" },
      { id: 37, text: "I accidentally locked myself out of my room. Could you please let me back in?", translation: "我不小心把自己锁在门外了。您能帮我开门吗？" },
      { id: 38, text: "Of course. May I see your identification to verify you are the registered guest?", translation: "当然可以。我可以看一下您的身份证件确认您是登记住客吗？" },
      { id: 39, text: "Is there a business center where I can print some documents?", translation: "这里有商务中心可以打印文件吗？" },
      { id: 40, text: "Yes, the business center is next to the lobby. It's open twenty-four hours and printing is complimentary.", translation: "有的，商务中心在大厅旁边。二十四小时开放，打印免费。" },
      { id: 41, text: "Could you arrange a wake-up call for six thirty tomorrow morning?", translation: "您能帮我安排明天早上六点半的叫醒服务吗？" },
      { id: 42, text: "Certainly. I've set a wake-up call for six thirty AM. Is there anything else I can help you with?", translation: "当然可以。我已经设置了早上六点半的叫醒服务。还有什么我能帮您的吗？" },
    ],
  },
{
    id: "it-incident-response",
    title: "IT Operations - Incident Response Call",
    titleCn: "IT 运维：故障响应电话会",
    source: "Original IT English",
    category: "speech",
    difficulty: 2,
    sentences: [
      { id: 1, text: "We are opening a severity-one incident for the checkout API latency spike.", translation: "我们正在为结账 API 延迟飙升开启一级故障。" },
      { id: 2, text: "Error rates climbed above five percent starting at fourteen thirty UTC.", translation: "从协调世界时十四点三十分起，错误率升至百分之五以上。" },
      { id: 3, text: "Please freeze nonessential deployments until we restore a stable baseline.", translation: "在恢复稳定基线之前，请冻结非必要发布。" },
      { id: 4, text: "I am checking the dashboards for database connection pool saturation.", translation: "我正在查看仪表盘，确认数据库连接池是否饱和。" },
      { id: 5, text: "The autoscaler added three replicas, but p ninety-five latency is still high.", translation: "自动扩缩容已增加三个副本，但九十五分位延迟仍然偏高。" },
      { id: 6, text: "Can someone confirm whether the latest migration finished on the primary?", translation: "有人能确认最新迁移是否已在主库完成吗？" },
      { id: 7, text: "We should roll back the payment-service release if the feature flag cannot be disabled.", translation: "如果无法关闭功能开关，我们应该回滚支付服务的发布。" },
      { id: 8, text: "Customer support needs a status update every fifteen minutes.", translation: "客服需要每十五分钟收到一次状态更新。" },
      { id: 9, text: "I will post a timeline in the incident channel with hypotheses and owners.", translation: "我会在故障频道发布时间线，写上假设与负责人。" },
      { id: 10, text: "Let's capture request IDs from failing checkouts for the postmortem.", translation: "我们把失败结账的请求 ID 收集起来，供事后复盘使用。" },
      { id: 11, text: "After mitigation, keep the war room open for thirty minutes of monitoring.", translation: "缓解之后，作战室再保持三十分钟监控。" },
      { id: 12, text: "Our immediate goal is to bring error rates under one percent.", translation: "当前目标是把错误率压回百分之一以下。" },
      { id: 13, text: "Please verify that retries are not amplifying load on the dependency.", translation: "请确认重试没有把依赖服务的负载放大。" },
      { id: 14, text: "If the cache miss rate stays elevated, we will warm the hot keys manually.", translation: "如果缓存未命中率持续偏高，我们将手动预热热点键。" },
      { id: 15, text: "Document every change so we can reconstruct the sequence later.", translation: "请记录每一次变更，方便之后还原操作顺序。" },
      { id: 16, text: "We will schedule a blameless postmortem within twenty-four hours.", translation: "我们将在二十四小时内安排一次无指责复盘。" },
    ],
  },
  {
    id: "it-code-review-pr",
    title: "Software Engineering - Pull Request Review",
    titleCn: "软件工程：代码评审对话",
    source: "Original IT English",
    category: "drama",
    difficulty: 2,
    sentences: [
      { id: 1, text: "Thanks for reviewing this pull request so quickly.", translation: "谢谢你这么快审完这个拉取请求。" },
      { id: 2, text: "The main risk is the new caching layer around the user profile endpoint.", translation: "主要风险在于用户资料接口上的新缓存层。" },
      { id: 3, text: "I added an integration test that covers stale data after a profile update.", translation: "我加了一个集成测试，覆盖资料更新后的脏数据场景。" },
      { id: 4, text: "Could we extract the retry logic into a shared utility?", translation: "我们能否把重试逻辑抽成共享工具函数？" },
      { id: 5, text: "The function name is a bit vague; maybe rename it to fetchProfileWithTimeout.", translation: "函数名有点含糊，或许改成 fetchProfileWithTimeout 更清楚。" },
      { id: 6, text: "I left a comment about the missing null check on the optional email field.", translation: "我在可选邮箱字段缺空值检查的地方留了评论。" },
      { id: 7, text: "Please avoid logging access tokens, even in debug mode.", translation: "即使是调试模式，也请不要把访问令牌打进日志。" },
      { id: 8, text: "The migration looks reversible; good job including a down script.", translation: "迁移看起来可回滚，写了 down 脚本很好。" },
      { id: 9, text: "Have we measured how this query behaves with one million rows?", translation: "我们测过这个查询在一百万行时的表现吗？" },
      { id: 10, text: "I would prefer an index on tenant_id and updated_at together.", translation: "我更希望在 tenant_id 和 updated_at 上建联合索引。" },
      { id: 11, text: "Once those two comments are addressed, I am happy to approve.", translation: "那两条评论处理完后，我就可以批准。" },
      { id: 12, text: "CI is red because the typecheck failed after the interface change.", translation: "持续集成变红了，因为接口变更后类型检查失败。" },
      { id: 13, text: "Let me squash the fixup commits before we merge to main.", translation: "合并到主分支前，我先把 fixup 提交压缩掉。" },
      { id: 14, text: "We should update the API contract doc in the same change.", translation: "我们应该在同一次改动里更新 API 合同文档。" },
      { id: 15, text: "I will request a second reviewer from the platform team.", translation: "我会再请平台组的同事做第二轮评审。" },
      { id: 16, text: "After merge, please watch the error budget for the next hour.", translation: "合并后请盯着接下来一小时的错误预算。" },
    ],
  },
  {
    id: "it-cloud-architecture",
    title: "Cloud Architecture - Designing for Failure",
    titleCn: "云架构：面向故障的设计",
    source: "Original IT English",
    category: "ted",
    difficulty: 3,
    sentences: [
      { id: 1, text: "Reliable systems assume that every network call can fail without warning.", translation: "可靠系统默认每一次网络调用都可能毫无征兆地失败。" },
      { id: 2, text: "Timeouts are not optional; they are how you bound the blast radius of a slow dependency.", translation: "超时不是可选项，而是限制慢依赖爆炸半径的方式。" },
      { id: 3, text: "A circuit breaker opens when consecutive failures cross a threshold.", translation: "当连续失败超过阈值时，断路器会打开。" },
      { id: 4, text: "Idempotent writes let you retry safely after a timeout with unknown results.", translation: "幂等写入让你在超时且结果未知时仍能安全重试。" },
      { id: 5, text: "Prefer eventual consistency when strong consistency would block the user path.", translation: "当强一致性会卡住用户路径时，优先选择最终一致性。" },
      { id: 6, text: "Separate the control plane from the data plane so admin tools cannot starve production traffic.", translation: "把控制面与数据面分开，避免管理工具饿死生产流量。" },
      { id: 7, text: "Health checks should verify dependencies, not only process liveness.", translation: "健康检查应验证依赖，而不仅是进程是否存活。" },
      { id: 8, text: "Capacity planning without load tests is mostly storytelling.", translation: "没有压测的容量规划多半是在讲故事。" },
      { id: 9, text: "Observability means you can ask new questions without shipping new instrumentation every time.", translation: "可观测性意味着你可以提出新问题，而不必每次都加埋点再发版。" },
      { id: 10, text: "Traces connect a single user request across services, queues, and databases.", translation: "链路追踪把一次用户请求串到服务、队列和数据库上。" },
      { id: 11, text: "Secrets belong in a managed store, never in container images or chat logs.", translation: "密钥应放在托管密钥库，绝不进入镜像或聊天记录。" },
      { id: 12, text: "Blue-green releases reduce risk, but only if you can switch traffic quickly both ways.", translation: "蓝绿发布能降低风险，前提是流量可以快速双向切换。" },
      { id: 13, text: "Feature flags let you dark-launch code and measure impact before a full rollout.", translation: "功能开关让你暗发布代码，在全量前先衡量影响。" },
      { id: 14, text: "Runbooks turn tribal knowledge into steps a tired on-call engineer can follow.", translation: "运行手册把口口相传的知识变成值班工程师疲惫时也能执行的步骤。" },
      { id: 15, text: "The cheapest outage to fix is the one you rehearse in a game day.", translation: "成本最低的故障修复，是你在演练日里先练过的那次。" },
      { id: 16, text: "Design for failure first, then optimize for performance and cost.", translation: "先为故障而设计，再优化性能与成本。" },
    ],
  },
  {
    id: "it-security-standup",
    title: "Security Engineering - Morning Standup",
    titleCn: "安全工程：早会同步",
    source: "Original IT English",
    category: "speech",
    difficulty: 3,
    sentences: [
      { id: 1, text: "Yesterday we finished rotating the production database credentials.", translation: "昨天我们完成了生产数据库凭证轮换。" },
      { id: 2, text: "The vulnerability scan found a high severity issue in a transitive dependency.", translation: "漏洞扫描在一个传递依赖里发现了高危问题。" },
      { id: 3, text: "We patched it overnight and verified the container rebuild in staging.", translation: "我们连夜打了补丁，并在预发验证了容器重建。" },
      { id: 4, text: "Today I will review the pull requests that touch authentication middleware.", translation: "今天我会审涉及认证中间件的拉取请求。" },
      { id: 5, text: "Please treat any temporary privilege escalation as an exception with an expiry date.", translation: "任何临时提权都请当作带到期日的例外处理。" },
      { id: 6, text: "Phishing simulations start next week; remind your teams not to reuse passwords.", translation: "钓鱼演练下周开始；提醒团队不要复用密码。" },
      { id: 7, text: "We need evidence that access reviews were completed for all admin roles.", translation: "我们需要所有管理员角色都已完成访问复核的证据。" },
      { id: 8, text: "Do not paste secrets into tickets; use the secure sharing workflow instead.", translation: "不要把密钥粘贴到工单里，改用安全共享流程。" },
      { id: 9, text: "The WAF rule for credential stuffing is in detect mode until we confirm false positives.", translation: "防撞库的 WAF 规则先处在检测模式，直到我们确认误报情况。" },
      { id: 10, text: "I blocked merge of one change because it disabled certificate pinning in the mobile client.", translation: "我拦截了一次合并，因为它在移动端关掉了证书锁定。" },
      { id: 11, text: "Audit logs must remain immutable even when operators need to investigate.", translation: "即使运维需要排查，审计日志也必须保持不可篡改。" },
      { id: 12, text: "If you discover an exposed key, revoke first and investigate second.", translation: "如果发现密钥泄露，先吊销，再调查。" },
      { id: 13, text: "Least privilege is easier to add early than to retrofit after an incident.", translation: "最小权限最好在早期加上，出事后再补会难很多。" },
      { id: 14, text: "We will table the new SSO rollout until the identity provider outage report is done.", translation: "在身份提供商故障报告完成前，我们暂缓新的单点登录上线。" },
      { id: 15, text: "Any questions before we close the standup?", translation: "站会结束前还有问题吗？" },
      { id: 16, text: "Great, let's sync again tomorrow at the same time.", translation: "好，我们明天同一时间再同步。" },
    ],
  },
]);
