import { getOctokit } from '@actions/github'
import { getInput, info, setFailed } from '@actions/core'


const run = async (): Promise<void> => {
  try {
    const parentRepo = getInput('parent_repo');
    const workflowFileName = getInput('workflow_file_name');
    const branch = getInput('branch');
    const token = process.env.GITHUB_TOKEN || '';
    if (!token) {
      throw "No GITHUB_TOKEN is set"
    }
    const owner = parentRepo.split('/')[0];
    const repo = parentRepo.split('/')[1]

    const octokit = getOctokit(token);
    const res = await octokit.actions.listWorkflowRuns({ owner, repo, workflow_id: workflowFileName as any, branch, event: 'pull_request' });
    const workflowRuns = res.data.workflow_runs;
    const runIds = workflowRuns.map(workflowRun => workflowRun.id)
    const runArtifactsP = runIds.map(runId => octokit.actions.listWorkflowRunArtifacts({ owner, repo, run_id: runId }))
    const runArtifacts = (await Promise.all(runArtifactsP)).map(res => res.data.artifacts).filter(runArtifacts => runArtifacts.length > 0)
    const artifacts = runArtifacts.flat()
    if (artifacts.length == 0) {
      info('There are no artifacts to clean up')
      return;
    } else {
      info(`Found ${artifacts.length} artifacts`)
    }
    const artifactIds = artifacts.map(artifact => artifact.id)
    const artifactBloat = artifacts.reduce((acc, artifact) => artifact.size_in_bytes + acc, 0) / 1000000
    const deleteP = artifactIds.map(artifactId => octokit.actions.deleteArtifact({ owner, repo, artifact_id: artifactId }))
    await Promise.all(deleteP)
    info(`Cleaned up ${Math.round(artifactBloat)}MB of artifacts`)
  } catch (err) {
    setFailed(err)
  }

}

void run()