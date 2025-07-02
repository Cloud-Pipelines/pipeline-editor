import { useMutation } from "@tanstack/react-query";
import { CircleStopIcon, Frown, Videotape } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useExecutionStatusQuery } from "@/hooks/useExecutionStatusQuery";
import useToastNotification from "@/hooks/useToastNotification";
import {
  countTaskStatuses,
  fetchExecutionInfo,
  getRunStatus,
} from "@/services/executionService";
import { fetchPipelineRunById } from "@/services/pipelineRunService";
import type { PipelineRun } from "@/types/pipelineRun";
import type { ComponentSpec } from "@/utils/componentSpec";

import { StatusBar, StatusIcon, StatusText } from "../shared/Status";
import { TaskImplementation } from "../shared/TaskDetails";

type RunDetailsProps = {
  executionId?: string;
};

const cancelPipelineRun = async (runId: string): Promise<{id: string, status: string}> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      console.log("Emulation of cancelling run", runId);

      resolve({
        id: runId,
        status: "cancelled",
      });
    }, 1000);
  });
}

const CancelButton = ({
  runId
}: {runId: string | null | undefined}) => {

  const notify = useToastNotification();

  const [confirmAction, setConfirmAction] = useState(false);

  const {
    mutate: cancelPipeline,
    isPending,
    isSuccess,
  } = useMutation({
    mutationFn: cancelPipelineRun,
    onSuccess: (responseData) => {
      notify(`Pipeline run ${responseData.id} cancelled`, "success");
    },
    onError: (error) => {
      setConfirmAction(false);
      notify(`Error cancelling run: ${error}`, "error");
    },
  });

  const handleDelete = useCallback(async () => {
    if (confirmAction && runId) {
      try {
        cancelPipeline(runId);
      } catch (error) {
        notify(`Error cancelling run: ${error}`, "error");
      }
    } else {
      setConfirmAction(true);
    }
  }, [confirmAction]);

  if(isSuccess) {
    return <Button disabled>Cancelled</Button>;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="destructive" onClick={handleDelete} disabled={isPending}>
          {isPending ? (
            <Spinner className="mr-2" />
          ) : (
            <div className="flex items-center gap-2">
              {confirmAction ? (
                <span className="text-xs">Confirm run cancellation</span>
              ): (
                <>Cancel run <CircleStopIcon className="w-4 h-4" /></>
              )}
            </div>
          )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          Confirm run cancellation. This action cannot be undone.
        </TooltipContent>
      </Tooltip>
  );
};

export const RunDetails = ({ executionId = "" }: RunDetailsProps) => {
  const [metadata, setMetadata] = useState<PipelineRun | null>(null);

  const { data: status } = useExecutionStatusQuery(executionId);

  const { data, isLoading, error } = fetchExecutionInfo(executionId);
  const { details, state } = data;

  const runId = details?.pipeline_run_id;

  const componentSpec = details?.task_spec?.componentRef?.spec;

  useEffect(() => {
    const fetchData = async () => {
      const res = await fetchPipelineRunById(`${runId}`);
      if (!res) return;

      const runData = res as PipelineRun;

      runData.status = status;

      setMetadata(runData);
    };

    fetchData();
  }, [runId, status]);

  if (error || !details || !state || !componentSpec) {
    return (
      <div className="flex flex-col gap-8 items-center justify-center h-full">
        <Frown className="w-12 h-12 text-gray-500" />
        <div className="text-gray-500">Error loading run details.</div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Spinner className="mr-2" />
        <p className="text-gray-500">Loading run details...</p>
      </div>
    );
  }

  const statusCounts = countTaskStatuses(details, state);
  const runStatus = getRunStatus(statusCounts);

  const isRunning = status === "RUNNING";

  const annotations = componentSpec.metadata?.annotations || {};

  return (
    <div className="p-2 flex flex-col gap-6">
      <div className="flex items-center gap-2 max-w-[90%]">
        <Videotape className="w-6 h-6 text-gray-500" />
        <h2 className="text-lg font-semibold">
          {componentSpec.name ?? "Unnamed Pipeline"}
        </h2>
        <StatusIcon status={runStatus} tooltip />

      </div>

      {metadata && (
        <div className="flex flex-col gap-2 text-xs text-secondary-foreground mb-2">
          <div className="flex flex-wrap gap-x-6">
            {metadata.id && (
              <div>
                <span className="font-semibold">Run Id:</span> {metadata.id}
              </div>
            )}
            {metadata.root_execution_id && (
              <div>
                <span className="font-semibold">Execution Id:</span>{" "}
                {metadata.root_execution_id}
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-6">
            {metadata.created_by && (
              <div>
                <span className="font-semibold">Created by:</span>{" "}
                {metadata.created_by}
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-x-6">
            {metadata.created_at && (
              <div>
                <span className="font-semibold">Created at:</span>{" "}
                {new Date(metadata.created_at).toLocaleString()}
              </div>
            )}
          </div>
        </div>
      )}

      {componentSpec.description && (
        <div>
          <h3 className="text-md font-medium mb-1">Description</h3>
          <div className="text-sm text-gray-700 whitespace-pre-line">
            {componentSpec.description}
          </div>
        </div>
      )}

      <div>
        <div className="flex gap-2">
          <h3 className="text-md font-medium">Status: {status} </h3>
          <StatusText statusCounts={statusCounts} />
        </div>
        <div className="flex flex-col gap-2">
          <StatusBar statusCounts={statusCounts} />
        </div>
      </div>

      {isRunning && <CancelButton runId={runId}/>}


      {Object.keys(annotations).length > 0 && (
        <div>
          <h3 className="text-md font-medium mb-1">Annotations</h3>
          <ul className="text-xs text-secondary-foreground">
            {Object.entries(annotations).map(([key, value]) => (
              <li key={key}>
                <span className="font-semibold">{key}:</span>{" "}
                <span className="break-all">{String(value)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <h3 className="text-md font-medium mb-1">Artifacts</h3>
        <div className="flex gap-4">
          <div className="flex-1">
            <h4 className="text-sm font-semibold mb-1">Inputs</h4>
            {componentSpec.inputs && componentSpec.inputs.length > 0 ? (
              <ul className="list-disc list-inside text-sm text-secondary-foreground">
                {componentSpec.inputs.map((input) => (
                  <li key={input.name}>
                    <span className="font-semibold">{input.name}</span>
                    {input.type && (
                      <span className="ml-2 text-muted-foreground">
                        (
                        {typeof input.type === "string" ? input.type : "object"}
                        )
                      </span>
                    )}
                    {input.description && (
                      <div className="text-xs text-secondary-foreground ml-4">
                        {input.description}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-xs text-muted-foreground">No inputs</div>
            )}
          </div>
          <div className="flex-1">
            <h4 className="text-sm font-semibold mb-1">Outputs</h4>
            {componentSpec.outputs && componentSpec.outputs.length > 0 ? (
              <ul className="list-disc list-inside text-sm text-secondary-foreground">
                {componentSpec.outputs.map((output) => (
                  <li key={output.name}>
                    <span className="font-semibold">{output.name}</span>
                    {output.type && (
                      <span className="ml-2 text-muted-foreground">
                        (
                        {typeof output.type === "string"
                          ? output.type
                          : "object"}
                        )
                      </span>
                    )}
                    {output.description && (
                      <div className="text-xs text-secondary-foreground ml-4">
                        {output.description}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-xs text-muted-foreground">No outputs</div>
            )}
          </div>
        </div>
      </div>

      {componentSpec && (
        <div className="flex flex-col">
          <div className="font-medium text-md flex items-center gap-1 cursor-pointer">
            Pipeline YAML
          </div>
          <div className="mt-1 max-h-[512px] overflow-y-auto">
            <TaskImplementation
              displayName={componentSpec.name ?? "Pipeline"}
              componentSpec={componentSpec as ComponentSpec}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default RunDetails;
