import { create } from 'zustand';

export const useRenderStore = create((set) => ({
  currentJob: null,
  renderJobs: [],
  isLoading: false,
  error: null,
  
  setCurrentJob: (job) => set({ currentJob: job }),
  setRenderJobs: (jobs) => set({ renderJobs: jobs }),
  setLoading: (loading) => set({ isLoading: loading }),
  setError: (err) => set({ error: err }),
  
  updateJobProgress: (jobId, progress, status, outputUrl = null, errorMsg = null) => set((state) => {
    const updatedJob = state.currentJob && state.currentJob.id === jobId
      ? { ...state.currentJob, progress, status, output_url: outputUrl, error_msg: errorMsg }
      : state.currentJob;
      
    const updatedJobs = state.renderJobs.map((job) => 
      job.id === jobId ? { ...job, progress, status, output_url: outputUrl, error_msg: errorMsg } : job
    );
    
    return {
      currentJob: updatedJob,
      renderJobs: updatedJobs
    };
  })
}));
