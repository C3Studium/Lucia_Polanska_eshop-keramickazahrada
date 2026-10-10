import { Badge } from "@medusajs/ui";
import {
  CASE_LABEL,
  deadlineInfo,
  isClaimCase,
  isFinalStatus,
  KIND_META,
  RESOLUTION_LABEL,
  STATUS_META,
  type ReturnRequest,
} from "../../lib/return-requests";
import { DamageBadge } from "../return-line-items";

/**
 * Řádek badge k žádosti: druh · stav · lhůta · případ · poškození · co
 * zákazník žádá · co bylo rozhodnuto · číslo protokolu. Jedno místo, aby
 * hlavička stránky a případné další výpisy nelhaly jinak.
 */
export const RequestBadges = ({
  request,
  claimCase,
}: {
  request: ReturnRequest;
  /** `case` z detailu (§12.2); bez něj se badge případu nekreslí. */
  claimCase?: string | null;
}) => {
  const deadline = isFinalStatus(request.status) ? null : deadlineInfo(request.resolve_by);

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {request.kind && (
        <Badge size="2xsmall" color={KIND_META[request.kind].color}>
          {KIND_META[request.kind].label}
        </Badge>
      )}
      <Badge size="2xsmall" color={STATUS_META[request.status].color}>
        {STATUS_META[request.status].label}
      </Badge>
      {deadline && (
        <Badge size="2xsmall" color={deadline.color}>
          {deadline.label}
        </Badge>
      )}
      {isClaimCase(claimCase) && (
        <Badge size="2xsmall" color="grey">
          {CASE_LABEL[claimCase]}
        </Badge>
      )}
      <DamageBadge cause={request.damage_cause} />
      {request.kind === "reklamace" && request.requested_resolution && (
        <Badge size="2xsmall" color="grey">
          Žádá: {RESOLUTION_LABEL[request.requested_resolution]}
        </Badge>
      )}
      {request.resolution && request.status !== "pending" && (
        <Badge size="2xsmall" color="green">
          Rozhodnuto: {RESOLUTION_LABEL[request.resolution]}
        </Badge>
      )}
      {request.protocol_number && (
        <Badge size="2xsmall" color="grey">
          {request.protocol_number}
        </Badge>
      )}
    </div>
  );
};
