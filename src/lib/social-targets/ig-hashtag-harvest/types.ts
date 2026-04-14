export type IGHashtagHarvestInput = {
  hashtag: string;
  limit?: number;
};

export type IGHashtagPost = {
  postId: string;
  postUrl: string;
  username: string;
  profileUrl: string;
  caption: string;
  hashtags: string[];
  likeCount: number;
  commentCount: number;
  timestamp: string;
  weeksAgo: number;
};

export type IGHashtagHarvestResult = {
  hashtag: string;
  requestedLimit: number;
  postsPulled: number;
  evidenceAdded: number;
  operatorsCreated?: number;
  operatorsMerged?: number;
  summaryPath: string;
  sample?: IGHashtagPost;
  posts?: IGHashtagPost[];
};
