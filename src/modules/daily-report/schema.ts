import { commonErrorResponses } from "../../common/commonResponse.js";
export const listDailyReportsSchema={querystring:{type:"object",required:["teamId"],properties:{teamId:{type:"string"},workDate:{type:"string"}}},response:{200:{type:"object"},...commonErrorResponses}};
