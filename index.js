import config from "./config.json";
import dayjs from "dayjs";
import isBetween from "dayjs/plugin/isBetween";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";

const token = config["token"];
const bot_name = config["bot_name"];
const master_id = config["master_id"];
const chat_id = config["chat_id"];
const base_url = "https://leetcode-cn.com/graphql";
const leetcode_username = config["leetcode_username"];

dayjs.extend(isBetween);
dayjs.extend(utc);
dayjs.extend(timezone);

addEventListener("fetch", event => {
  event.respondWith(handleRequest(event.request));
});

addEventListener("scheduled", event => {
  event.waitUntil(handleCronRequest(event));
});

async function handleRequest(request) {
  if (request.method === "POST") {
    let data = await request.json();
    let chat_id = data.message.chat.id;
    let text = data.message.text || "";
    let texts = text.split(" ");
    if (text[0] === "/") {
      texts[0] = texts[0].replace("/", "").replace(bot_name, "");
      switch (texts[0]) {
        case "start":
          await tg(token, "sendMessage", {
            chat_id: chat_id,
            text: "查询卷王 leetcode 进度。"
          });
          break;
        case "progress":
          let { ACTotal, todayACTotal, todaySubmissions } = await getProfile();
          await tg(token, "sendMessage", {
            chat_id: chat_id,
            text: `卷王一共刷了 ${ACTotal} 题，今天提交了 ${todaySubmissions} 次，AC 了 ${todayACTotal} 题，你呢？`
          });
          break;
      }
    }
  }

  return new Response("ok", { status: 200 });
}

async function handleCronRequest(event) {
  switch (event.cron) {
    case "*/5 * * * *":
      await notifySubmissions();
      break;
    case "0 18 * * *":
      await updateACTotal();
      break;
  }
}

async function tg(token, type, data) {
  let response = await (
    await fetch(`https://api.telegram.org/bot${token}/${type}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(data)
    })
  ).json();
  if (!response.ok) {
    await tg(token, "sendMessage", {
      chat_id: master_id,
      text: JSON.stringify(response)
    });
  }
}

const profile_data = {
  operationName: "userPublicProfile",
  variables: {
    userSlug: leetcode_username
  },
  query:
    "query userPublicProfile($userSlug: String!) {\n  userProfilePublicProfile(userSlug: $userSlug) {\n    username\n    haveFollowed\n    siteRanking\n    profile {\n      userSlug\n      realName\n      aboutMe\n      userAvatar\n      location\n      gender\n      websites\n      skillTags\n      contestCount\n      asciiCode\n      medals {\n        name\n        year\n        month\n        category\n        __typename\n      }\n      ranking {\n        rating\n        ranking\n        currentLocalRanking\n        currentGlobalRanking\n        currentRating\n        ratingProgress\n        totalLocalUsers\n        totalGlobalUsers\n        __typename\n      }\n      skillSet {\n        langLevels {\n          langName\n          langVerboseName\n          level\n          __typename\n        }\n        topics {\n          slug\n          name\n          translatedName\n          __typename\n        }\n        topicAreaScores {\n          score\n          topicArea {\n            name\n            slug\n            __typename\n          }\n          __typename\n        }\n        __typename\n      }\n      socialAccounts {\n        provider\n        profileUrl\n        __typename\n      }\n      __typename\n    }\n    educationRecordList {\n      unverifiedOrganizationName\n      __typename\n    }\n    occupationRecordList {\n      unverifiedOrganizationName\n      jobTitle\n      __typename\n    }\n    submissionProgress {\n      totalSubmissions\n      waSubmissions\n      acSubmissions\n      reSubmissions\n      otherSubmissions\n      acTotal\n      questionTotal\n      __typename\n    }\n    __typename\n  }\n}\n"
};

const submission_data = {
  operationName: "recentSubmissions",
  query:
    "query recentSubmissions($userSlug: String!) {\n  recentSubmissions(userSlug: $userSlug) {\n    status\n    lang\n    source {\n      sourceType\n      ... on SubmissionSrcLeetbookNode {\n        slug\n        title\n        pageId\n        __typename\n      }\n      __typename\n    }\n    question {\n      questionFrontendId\n      title\n      translatedTitle\n      titleSlug\n      __typename\n    }\n    submitTime\n    __typename\n  }\n}\n",
  variables: {
    userSlug: leetcode_username
  }
};

async function getACTotal() {
  let data = await (
    await fetch(base_url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(profile_data)
    })
  ).json();
  return await data["data"]["userProfilePublicProfile"]["submissionProgress"][
    "acTotal"
  ];
}

async function getSubmissions() {
  let data = await (
    await fetch(base_url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(submission_data)
    })
  ).json();
  return await data["data"]["recentSubmissions"];
}

async function getTodaySubmissions() {
  let submissions = await getSubmissions();
  return submissions.filter(submission => {
    let submitTime = dayjs(submission["submitTime"] * 1000).tz("Asia/Shanghai");
    let startTime = dayjs()
      .tz("Asia/Shanghai")
      .startOf("day");
    let endTime = dayjs()
      .tz("Asia/Shanghai")
      .endOf("day");
    return submitTime.isBetween(startTime, endTime);
  });
}

async function notifySubmissions() {
  let submissions = await getSubmissions();
  let lastSubmitTime = await LEETCODE.get("submitTime");
  let newSubmissions = submissions.filter(submission => {
    let submitTime = submission["submitTime"];
    return submitTime > lastSubmitTime;
  });
  let { todayACTotal, todaySubmissions } = await getProfile();
  if (newSubmissions.length > 0) {
    await tg(token, "sendMessage", {
      chat_id: chat_id,
      text: `卷王刚才又提交了 ${newSubmissions.length} 次，今天一共提交了 ${todaySubmissions} 次，AC 了 ${todayACTotal} 题。`
    });
    await LEETCODE.put("submitTime", newSubmissions[0]["submitTime"]);
  }
}

async function updateACTotal() {
  let acTotal = await getACTotal();
  await LEETCODE.put("acTotal", acTotal);
}

async function getProfile() {
  let ACTotal = await getACTotal();
  let pastACTotal = await LEETCODE.get("acTotal");
  let todaySubmissions = await getTodaySubmissions();
  return {
    ACTotal,
    todayACTotal: ACTotal - pastACTotal,
    todaySubmissions: todaySubmissions.length
  };
}
