const token = ''
const bot_username = ''
const master_id = 12332
const chat_id = 323222
const base_url = 'https://leetcode-cn.com/graphql'
const leetcode_username = ''

addEventListener('fetch', (event) => {
  event.respondWith(handleRequest(event.request))
})

// addEventListener('schedule', (event) => {
//   event.waitUntil(handleCronRequest(event.request))
// })

async function handleRequest(request) {
  if (request.method === 'POST') {
    let data = await request.json()
    let chat_id = data.message.chat.id
    let text = data.message.text || ''
    let otext = text.split(' ')
    if (text[0] === '/') {
      otext[0] = otext[0].replace('/', '').replace(bot_username, '')
      switch (otext[0]) {
        case 'start':
          await tg(token, 'sendMessage', {
            chat_id: chat_id,
            text: '查询卷王 leetcode 进度。',
          })
          break
        case 'progress':
          let profile
          await getProfile().then((response) => {
            profile =
              response['data']['userProfilePublicProfile'][
                'submissionProgress'
              ]['acTotal']
          })
          let submissions
          await getSubmission().then((response) => {
            submissions = response['data']['recentSubmissions']
          })
          let todaySubmissions = submissions.filter((submission) => {
            let submitTime = new Date(submission['submitTime'] * 1000)
            let { endTime, startTime } = getTodayStartTimeAndEndTime()
            return submitTime >= startTime && submitTime <= endTime
          })
          let questions = todaySubmissions.length
          await tg(token, 'sendMessage', {
            chat_id: chat_id,
            text: `卷王一共刷了 ${profile} 道题，其中今天刷了 ${questions} 题，你呢？`,
          })
          break
      }
    }
  }

  return new Response('ok', { status: 200 })
}

async function handleCronRequest(request) {
  if (request.method === 'POST') {
    let submissions
    await getSubmission().then((response) => {
      submissions = response['data']['recentSubmissions']
    })
    let todaySubmissions = submissions.filter((submission) => {
      // TODO
    })
    let questions = todaySubmissions.length
    await tg(token, 'sendMessage', {
      chat_id: chat_id,
      text: `卷刚才又刷了 ${questions} 题。`,
    })
  }

  return new Response('ok', { status: 200 })
}

async function tg(token, type, data, n = true) {
  try {
    let t = await fetch('https://api.telegram.org/bot' + token + '/' + type, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    })
    let d = await t.json()
    if (!d.ok && n) throw d
    else return d
  } catch (e) {
    await tg(
      token,
      'sendMessage',
      {
        chat_id: master_id,
        text:
          'Request tg error\n\n' /**+ JSON.stringify(data) + '\n\n' */ +
          JSON.stringify(e),
      },
      false,
    )
    return e
  }
}

profile_data = {
  operationName: 'userPublicProfile',
  variables: {
    userSlug: leetcode_username,
  },
  query:
    'query userPublicProfile($userSlug: String!) {\n  userProfilePublicProfile(userSlug: $userSlug) {\n    username\n    haveFollowed\n    siteRanking\n    profile {\n      userSlug\n      realName\n      aboutMe\n      userAvatar\n      location\n      gender\n      websites\n      skillTags\n      contestCount\n      asciiCode\n      medals {\n        name\n        year\n        month\n        category\n        __typename\n      }\n      ranking {\n        rating\n        ranking\n        currentLocalRanking\n        currentGlobalRanking\n        currentRating\n        ratingProgress\n        totalLocalUsers\n        totalGlobalUsers\n        __typename\n      }\n      skillSet {\n        langLevels {\n          langName\n          langVerboseName\n          level\n          __typename\n        }\n        topics {\n          slug\n          name\n          translatedName\n          __typename\n        }\n        topicAreaScores {\n          score\n          topicArea {\n            name\n            slug\n            __typename\n          }\n          __typename\n        }\n        __typename\n      }\n      socialAccounts {\n        provider\n        profileUrl\n        __typename\n      }\n      __typename\n    }\n    educationRecordList {\n      unverifiedOrganizationName\n      __typename\n    }\n    occupationRecordList {\n      unverifiedOrganizationName\n      jobTitle\n      __typename\n    }\n    submissionProgress {\n      totalSubmissions\n      waSubmissions\n      acSubmissions\n      reSubmissions\n      otherSubmissions\n      acTotal\n      questionTotal\n      __typename\n    }\n    __typename\n  }\n}\n',
}

submission_data = {
  operationName: 'recentSubmissions',
  query:
    'query recentSubmissions($userSlug: String!) {\n  recentSubmissions(userSlug: $userSlug) {\n    status\n    lang\n    source {\n      sourceType\n      ... on SubmissionSrcLeetbookNode {\n        slug\n        title\n        pageId\n        __typename\n      }\n      __typename\n    }\n    question {\n      questionFrontendId\n      title\n      translatedTitle\n      titleSlug\n      __typename\n    }\n    submitTime\n    __typename\n  }\n}\n',
  variables: {
    userSlug: leetcode_username,
  },
}

async function getProfile() {
  let data = await fetch(base_url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(profile_data),
  })
  return await data.json()
}

async function getSubmission() {
  let data = await fetch(base_url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(submission_data),
  })
  return await data.json()
}

function getTodayStartTimeAndEndTime(time) {
  time = time ? time : new Date()
  return {
    startTime: new Date(time.setHours(0, 0, 0, 0)),
    endTime: new Date(time.setHours(23, 59, 59, 999)),
  }
}
