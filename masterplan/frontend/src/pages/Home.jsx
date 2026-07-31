import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, FolderKanban, MapPin, Calendar, Trash2, Map } from 'lucide-react';
import { fetchProjects, deleteProject } from '../api/projects';
import Button from '../components/ui/Button';
import toast from 'react-hot-toast';

export default function Home() {
  const [projects, setProjects] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  const loadProjects = async () => {
    setIsLoading(true);
    try {
      const data = await fetchProjects();
      setProjects(data);
    } catch (err) {
      toast.error("Failed to load projects");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadProjects();
  }, []);

  const [projectToDelete, setProjectToDelete] = useState(null);

  const handleDeleteClick = (e, id) => {
    e.preventDefault();
    e.stopPropagation();
    setProjectToDelete(id);
  };

  const confirmDelete = async () => {
    if (!projectToDelete) return;
    try {
      await deleteProject(projectToDelete);
      toast.success("Project deleted successfully");
      loadProjects();
    } catch (err) {
      toast.error("Failed to delete project");
    } finally {
      setProjectToDelete(null);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex justify-between items-center mb-10">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
            <FolderKanban className="text-indigo-600" size={32} />
            MasterPlan Developer Projects
          </h1>
          <p className="text-slate-600 text-sm mt-1">Manage and edit your real estate layouts and photorealistic renders.</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={() => navigate('/maps')} 
            className="flex items-center gap-1.5 text-sm font-semibold text-slate-700 hover:text-slate-950 border border-slate-200 hover:bg-slate-50 px-4 py-2.5 rounded transition-colors"
          >
            <Map size={16} />
            Configure Maps
          </button>
          <button 
            onClick={() => navigate('/new-project')}
            className="flex items-center gap-1.5 bg-black hover:bg-neutral-800 text-white font-semibold py-2.5 px-4 rounded shadow text-sm transition-all hover:scale-[1.02]"
          >
            <Plus size={16} />
            Create New Project
          </button>
        </div>
      </div>

      {/* Project Cards Grid */}
      {isLoading ? (
        <div className="flex justify-center items-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600" />
        </div>
      ) : projects.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-lg p-12 text-center shadow-sm">
          <FolderKanban className="mx-auto text-slate-300 mb-4" size={48} />
          <h3 className="text-lg font-bold text-slate-800">No projects found</h3>
          <p className="text-slate-500 text-sm mt-1">Get started by creating your first real estate site layout.</p>
          <Button onClick={() => navigate('/new-project')} variant="primary" className="mx-auto mt-6">
            <Plus size={16} />
            Create First Project
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map((project) => (
            <div
              key={project.id}
              onClick={() => navigate(`/editor/${project.id}`)}
              className="bg-white border border-slate-200 rounded-lg hover:border-slate-350 p-5 cursor-pointer shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between"
            >
              <div>
                <div className="flex justify-between items-start mb-2">
                  <h3 className="text-base font-bold text-slate-900 line-clamp-1">{project.name}</h3>
                  <button
                    onClick={(e) => handleDeleteClick(e, project.id)}
                    className="text-slate-400 hover:text-rose-600 p-1 rounded hover:bg-slate-100 transition-all"
                    title="Delete Project"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                <p className="text-slate-600 text-xs line-clamp-2 mb-4 h-8">{project.description || 'No description provided.'}</p>
              </div>

              <div className="space-y-2 border-t border-slate-100 pt-3">
                <div className="flex items-center gap-1.5 text-[10px] text-slate-600">
                  <MapPin size={12} className="text-indigo-600" />
                  <span className="truncate">{project.location_name || 'Manual Dimensions'}</span>
                </div>
                <div className="flex items-center justify-between text-[10px] text-slate-500">
                  <span className="flex items-center gap-1.5">
                    <Calendar size={12} />
                    {new Date(project.created_at).toLocaleDateString()}
                  </span>
                  <span className="font-semibold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded">
                    {project.site_width}m x {project.site_height}m
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete Project Confirmation Modal */}
      {projectToDelete && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden transform transition-all scale-100 duration-300">
            <div className="bg-rose-900 p-5 text-white flex items-center gap-3">
              <div className="p-2 bg-rose-500/20 text-rose-300 rounded-lg">
                <Trash2 size={20} className="animate-bounce" />
              </div>
              <div>
                <h3 className="text-base font-bold">Delete Project</h3>
                <p className="text-[11px] text-rose-300">Remove project design workspace</p>
              </div>
            </div>

            <div className="p-6">
              <p className="text-sm font-semibold text-slate-800 mb-2">
                Are you sure you want to delete this project?
              </p>
              <p className="text-xs text-slate-500 leading-relaxed">
                This will permanently delete this project workspace, including all of its layouts, boundaries, configurations, and renders. <strong className="text-rose-600">This action cannot be undone.</strong>
              </p>
            </div>

            <div className="bg-slate-50 px-6 py-4 border-t border-slate-100 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setProjectToDelete(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 size={14} />
                Delete Project
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
