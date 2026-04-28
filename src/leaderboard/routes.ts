import { getLeaderboard } from "./repo";

export const routes = {
  "/api/leaderboard": {
    GET: async (_req: Request) => {
      const rows = await getLeaderboard();
      return Response.json(rows);
    },
  },
};
