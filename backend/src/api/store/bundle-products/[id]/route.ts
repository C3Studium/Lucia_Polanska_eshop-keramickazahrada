import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { QueryContext } from "@medusajs/framework/utils";
import { presentBundle } from "../../../../modules/bundled-product/presentation";

export async function GET(
  req: MedusaRequest,
  res: MedusaResponse
) {
  const { id } = req.params
  const query = req.scope.resolve("query")
  const { currency_code, region_id } = req.query

  const { data } = await query.graph({
    entity: "bundle",
    fields: [
      "*", 
      "product.*",
      "product.variants.*",
      "product.variants.calculated_price.*",
      "items.*", 
      "items.product.*", 
      "items.product.options.*",
      "items.product.options.values.*",
      "items.product.variants.*",
      "items.product.variants.calculated_price.*",
      "items.product.variants.options.*",
      "items.product_variant.*",
      "items.product_variant.calculated_price.*",
    ],
    filters: {
      id
    },
    context: {
      product: {
        variants: {
          calculated_price: QueryContext({ region_id, currency_code }),
        },
      },
      items: {
        product: {
          variants: {
            calculated_price: QueryContext({
              region_id,
              currency_code,
            }),
          },
        },
        product_variant: {
          calculated_price: QueryContext({ region_id, currency_code }),
        },
      }
    },
  
  }, {
    throwIfKeyNotFound: true
  })

  res.json({
    bundle_product: presentBundle(data[0])
  })
}
