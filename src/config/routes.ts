import hackathonConfig from "../../hackathon.config";

/** Public-safe subset — no secrets, no judge list. Safe to send to the browser. */
export const routes = {
  "/api/config": {
    GET: async (_req: Request) => {
      return Response.json({
        branding: hackathonConfig.branding,
        requirements: hackathonConfig.requirements,
      });
    },
  },
};
