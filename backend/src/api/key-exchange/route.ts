import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { IApiKeyModuleService } from '@medusajs/framework/types';
import { Modules } from '@medusajs/framework/utils';

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  try {
    const apiKeyModuleService: IApiKeyModuleService = req.scope.resolve(Modules.API_KEY);
    const apiKeys = await apiKeyModuleService.listApiKeys({
      title: 'Webshop',
      type: 'publishable',
    });
    const defaultApiKey = apiKeys[0];

    if (!defaultApiKey?.token) {
      return res.status(404).json({
        error: "The Webshop publishable API key is not configured",
      });
    }

    res.setHeader("Cache-Control", "no-store");
    return res.json({ publishableApiKey: defaultApiKey.token });
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
