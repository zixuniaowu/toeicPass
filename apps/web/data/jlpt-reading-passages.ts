export type JlptReadingPassage = {
  id: string;
  jlptLevel: "N5" | "N4" | "N3";
  title: string;
  titleCn: string;
  passage: string;
  summaryJa: string;
  summaryCn: string;
  questionJa: string;
  questionCn: string;
  hintJa: string;
  hintCn: string;
};

export const JLPT_READING_PASSAGES: JlptReadingPassage[] = [
  {
    id: "jlpt-reading-n5-library",
    jlptLevel: "N5",
    title: "としょかんのおしらせ",
    titleCn: "图书馆通知",
    passage: "あたらしい としょかんは らいしゅうの げつようびに あきます。がくせいは まいにち よる 8じまで べんきょうできます。どようびは ごご 5じに しまります。",
    summaryJa: "新しい図書館の開館時間についての短い案内です。",
    summaryCn: "这是一则关于新图书馆开放时间的短通知。",
    questionJa: "学生は いつまで 図書館で 勉強できますか。",
    questionCn: "学生最晚可以学习到几点？",
    hintJa: "時間に関する文を一つずつ確認してください。",
    hintCn: "先找和时间有关的句子，再确认工作日与周六的区别。",
  },
  {
    id: "jlpt-reading-n4-train",
    jlptLevel: "N4",
    title: "しんかんせんの へんこう",
    titleCn: "新干线变更通知",
    passage: "あしたの あさ、あめの ため しんかんせんの じこくが かわります。とうきょう 8じ はつの れっしゃは 20ぷん おくれて しゅっぱつします。えきで さいしんの あんないを みてください。",
    summaryJa: "雨の影響で新幹線の出発時刻が変わるという案内です。",
    summaryCn: "这是一则关于下雨导致新干线发车时间调整的通知。",
    questionJa: "東京8時発の列車は どうなりますか。",
    questionCn: "东京早上 8 点出发的列车会怎样？",
    hintJa: "変更された時間と、利用者に求めている行動を分けて読みましょう。",
    hintCn: "先抓住“晚点多久”，再看通知要求乘客做什么。",
  },
  {
    id: "jlpt-reading-n3-meeting",
    jlptLevel: "N3",
    title: "かいぎしつの よやく",
    titleCn: "会议室预约说明",
    passage: "かいぎしつを りようする ばあいは、まえのひまでに うけつけへ れんらくしてください。ただし、10にん いじょうで つかう ときは、3にちまえまでに よやくが ひつようです。とうじつの へんこうは でんわで そうだんできます。",
    summaryJa: "会議室予約の期限と、当日の変更方法を説明しています。",
    summaryCn: "这段说明介绍了会议室预约截止时间，以及当天变更的处理方式。",
    questionJa: "10人以上で使う場合、いつまでに予約しなければなりませんか。",
    questionCn: "如果 10 人以上使用，最晚要提前多久预约？",
    hintJa: "通常ルールと 10人以上の特別ルールを分けて整理してください。",
    hintCn: "区分一般规则和“10 人以上”的特别规则，不要混在一起。",
  },
];