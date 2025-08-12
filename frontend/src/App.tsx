import React, { useState, useEffect } from 'react';
import { Upload, FileSpreadsheet, ChevronLeft, ChevronRight, Download, Loader, CheckCircle, Target, Zap } from 'lucide-react';

const API_BASE = 'http://localhost:8000';

// Type definitions
interface Project {
  id: string;
  name: string;
  total_articles: number;
  completed_articles: number;
  status: string;
  created_at: string;
}

interface Article {
  id: string;
  from_url: string;
  to_url: string;
  main_kw: string;
  status: string;
  order_index: number;
  has_html: boolean;
  has_analysis: boolean;
}

interface LinkOpportunity {
  id: number;
  rating: number;
  location: string;
  context: string;
  old_text: string;
  new_text: string;
  reasoning: string;
  user_value: string;
}

interface AnalysisResult {
  opportunities: LinkOpportunity[];
  processing_time: number;
  article_type: string;
  reader_intent: string;
  best_strategy: string;
}

const TheSEOStrategist = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [articles, setArticles] = useState<Article[]>([]);
  const [currentArticleIndex, setCurrentArticleIndex] = useState(0);
  const [htmlContent, setHtmlContent] = useState('');
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showNewProject, setShowNewProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [customPrompt, setCustomPrompt] = useState('');
  const [opportunityCount, setOpportunityCount] = useState(3);
  const [currentOpportunityIndex, setCurrentOpportunityIndex] = useState(0);

  // Load projects on mount
  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    try {
      const response = await fetch(`${API_BASE}/projects`);
      const data = await response.json();
      setProjects(data);
    } catch (error) {
      console.error('Error loading projects:', error);
    }
  };

  const createProject = async () => {
    if (!newProjectName.trim()) return;
    
    try {
      const response = await fetch(`${API_BASE}/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newProjectName })
      });
      
      if (response.ok) {
        const project = await response.json();
        setProjects([project, ...projects]);
        setCurrentProject(project);
        setNewProjectName('');
        setShowNewProject(false);
      }
    } catch (error) {
      console.error('Error creating project:', error);
    }
  };

  const uploadExcel = async (file: File) => {
    if (!currentProject) return;
    
    const formData = new FormData();
    formData.append('file', file);
    
    try {
      const response = await fetch(`${API_BASE}/projects/${currentProject.id}/upload-excel`, {
        method: 'POST',
        body: formData
      });
      
      if (response.ok) {
        const result = await response.json();
        alert(`Successfully uploaded ${result.total_articles} articles`);
        loadProjectArticles(currentProject.id);
        loadProjects(); // Refresh project stats
      }
    } catch (error) {
      console.error('Error uploading Excel:', error);
    }
  };

  const loadProjectArticles = async (projectId: string) => {
    try {
      const response = await fetch(`${API_BASE}/projects/${projectId}/articles`);
      const data = await response.json();
      setArticles(data);
      setCurrentArticleIndex(0);
      setHtmlContent('');
      setAnalysisResult(null);
    } catch (error) {
      console.error('Error loading articles:', error);
    }
  };

  const analyzeCurrentArticle = async () => {
    if (!htmlContent.trim() || !articles[currentArticleIndex]) return;
    
    setIsAnalyzing(true);
    try {
      const response = await fetch(`${API_BASE}/articles/${articles[currentArticleIndex].id}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          article_id: articles[currentArticleIndex].id,
          html_content: htmlContent,
          custom_prompt: customPrompt || undefined,
          opportunity_count: opportunityCount
        })
      });
      
      if (response.ok) {
        const result = await response.json();
        setAnalysisResult(result);
        setCurrentOpportunityIndex(0); // Reset to first opportunity
        
        // Update article status in local state
        const updatedArticles = [...articles];
        updatedArticles[currentArticleIndex].status = 'completed';
        updatedArticles[currentArticleIndex].has_analysis = true;
        setArticles(updatedArticles);
      }
    } catch (error) {
      console.error('Error analyzing article:', error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const loadArticleAnalysis = async (articleId: string) => {
    try {
      const response = await fetch(`${API_BASE}/articles/${articleId}`);
      if (response.ok) {
        const articleData = await response.json();
        if (articleData.analysis) {
          setAnalysisResult(articleData.analysis);
          setCurrentOpportunityIndex(0); // Reset to first opportunity
        } else {
          setAnalysisResult(null);
        }
      }
    } catch (error) {
      console.error('Error loading article analysis:', error);
      setAnalysisResult(null);
    }
  };

  const navigateArticle = (direction: 'next' | 'prev') => {
    const newIndex = direction === 'next' 
      ? Math.min(currentArticleIndex + 1, articles.length - 1)
      : Math.max(currentArticleIndex - 1, 0);
    
    setCurrentArticleIndex(newIndex);
    setHtmlContent('');
    
    // Load analysis results for the new article if they exist
    if (articles[newIndex] && articles[newIndex].has_analysis) {
      loadArticleAnalysis(articles[newIndex].id);
    } else {
      setAnalysisResult(null);
    }
  };

  const exportResults = async () => {
    if (!currentProject) return;
    
    try {
      const response = await fetch(`${API_BASE}/projects/${currentProject.id}/export`, {
        method: 'POST'
      });
      
      if (response.ok) {
        const data = await response.json();
        
        // Create and download CSV
        const csv = [
          ['From URL', 'To URL', 'Main KW', 'Rating', 'Location', 'Old Text', 'New Text', 'Reasoning'],
          ...data.results.map((r: any) => [
            r.from_url, r.to_url, r.main_kw, r.rating, r.location, 
            r.old_text, r.new_text, r.reasoning
          ])
        ].map(row => row.map((cell: any) => `"${cell}"`).join(',')).join('\n');
        
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${currentProject.name}-results.csv`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Error exporting results:', error);
    }
  };

  const getRatingColor = (rating: number) => {
    if (rating >= 9) return 'bg-green-100 text-green-700 border-green-200';
    if (rating >= 7) return 'bg-yellow-100 text-yellow-700 border-yellow-200';
    return 'bg-red-100 text-red-700 border-red-200';
  };

  const currentArticle = articles[currentArticleIndex];
  const progress = articles.length > 0 ? ((currentArticleIndex + 1) / articles.length) * 100 : 0;
  const completedCount = articles.filter(a => a.status === 'completed').length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-md shadow-lg border-b border-white/20">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                The SEO Strategist
              </h1>
              <p className="text-gray-600 mt-1">AI-Powered Internal Link Placement Tool</p>
              {currentProject && (
                <div className="mt-2 flex items-center gap-2">
                  <div className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">
                    {currentProject.name}
                  </div>
                  <span className="text-gray-500">•</span>
                  <span className="text-gray-600 text-sm">
                    {completedCount}/{articles.length} completed
                  </span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-3">
              {currentProject && articles.length > 0 && (
                <button
                  onClick={exportResults}
                  className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-3 rounded-xl hover:from-blue-700 hover:to-blue-800 shadow-lg hover:shadow-xl transition-all duration-200 font-medium"
                >
                  <Download className="w-4 h-4" />
                  Export Results
                </button>
              )}
              <button
                onClick={() => setShowNewProject(true)}
                className="flex items-center gap-2 bg-gradient-to-r from-green-600 to-emerald-600 text-white px-6 py-3 rounded-xl hover:from-green-700 hover:to-emerald-700 shadow-lg hover:shadow-xl transition-all duration-200 font-medium"
              >
                <Target className="w-4 h-4" />
                New Project
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* New Project Modal */}
        {showNewProject && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md border border-white/20">
              <div className="text-center mb-6">
                <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Target className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900">Create New Project</h3>
                <p className="text-gray-600 text-sm mt-1">Start analyzing articles for link opportunities</p>
              </div>
              <input
                type="text"
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                placeholder="Enter project name..."
                className="w-full p-4 border border-gray-200 rounded-xl mb-6 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                onKeyPress={(e) => e.key === 'Enter' && createProject()}
                autoFocus
              />
              <div className="flex gap-3">
                <button
                  onClick={createProject}
                  disabled={!newProjectName.trim()}
                  className="flex-1 bg-gradient-to-r from-blue-600 to-blue-700 text-white py-3 px-4 rounded-xl hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-all"
                >
                  Create Project
                </button>
                <button
                  onClick={() => setShowNewProject(false)}
                  className="flex-1 bg-gray-100 text-gray-700 py-3 px-4 rounded-xl hover:bg-gray-200 font-medium transition-all"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Project Selection */}
        {!currentProject && (
          <div className="max-w-4xl mx-auto">
            <div className="bg-white/60 backdrop-blur-md rounded-2xl p-8 shadow-xl border border-white/20">
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <FileSpreadsheet className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-2">Your Projects</h3>
                <p className="text-gray-600">Manage your SEO link placement campaigns</p>
              </div>
              {projects.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Target className="w-10 h-10 text-gray-400" />
                  </div>
                  <h4 className="text-lg font-semibold text-gray-900 mb-2">No projects yet</h4>
                  <p className="text-gray-600 mb-6">Create your first project to get started with AI-powered link placement</p>
                  <button
                    onClick={() => setShowNewProject(true)}
                    className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 rounded-xl hover:from-blue-700 hover:to-purple-700 shadow-lg hover:shadow-xl transition-all duration-200 font-medium"
                  >
                    <Target className="w-4 h-4" />
                    Create First Project
                  </button>
                </div>
              ) : (
                <div className="grid gap-4">
                  {projects.map(project => {
                    const completionRate = project.total_articles > 0 ? (project.completed_articles / project.total_articles) * 100 : 0;
                    return (
                      <div
                        key={project.id}
                        onClick={() => {
                          setCurrentProject(project);
                          loadProjectArticles(project.id);
                        }}
                        className="group p-6 border border-gray-200 rounded-xl hover:border-blue-300 hover:shadow-lg cursor-pointer transition-all duration-200 bg-white/80 hover:bg-white"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-3">
                              <h4 className="text-lg font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">{project.name}</h4>
                              {project.status === 'completed' && <CheckCircle className="w-5 h-5 text-green-500" />}
                            </div>
                            <div className="flex items-center gap-4 text-sm text-gray-600 mb-3">
                              <span className="flex items-center gap-1">
                                <FileSpreadsheet className="w-4 h-4" />
                                {project.total_articles} articles
                              </span>
                              <span className="flex items-center gap-1">
                                <CheckCircle className="w-4 h-4" />
                                {project.completed_articles} completed
                              </span>
                              <span className="capitalize px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                {project.status}
                              </span>
                            </div>
                            {project.total_articles > 0 && (
                              <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                                <div 
                                  className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full transition-all duration-300"
                                  style={{ width: `${completionRate}%` }}
                                ></div>
                              </div>
                            )}
                            <p className="text-xs text-gray-500">
                              Created {new Date(project.created_at).toLocaleDateString()}
                            </p>
                          </div>
                          <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-blue-600 transition-colors ml-4" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Excel Upload */}
        {currentProject && articles.length === 0 && (
          <div className="max-w-4xl mx-auto">
            <div className="bg-white/60 backdrop-blur-md rounded-2xl p-8 shadow-xl border border-white/20">
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-gradient-to-r from-green-500 to-emerald-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Upload className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-2">Upload Excel File</h3>
                <p className="text-gray-600">Upload your article list to start finding link opportunities</p>
              </div>
              <div className="border-2 border-dashed border-blue-300 rounded-2xl p-12 text-center bg-blue-50/50 hover:border-blue-400 transition-colors">
                <FileSpreadsheet className="w-16 h-16 text-blue-500 mx-auto mb-6" />
                <div className="mb-6">
                  <h4 className="text-lg font-semibold text-gray-900 mb-2">Required Excel Format</h4>
                  <div className="inline-flex items-center gap-4 bg-white/80 rounded-xl p-4 text-sm font-medium">
                    <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-lg">From</span>
                    <span className="px-3 py-1 bg-green-100 text-green-800 rounded-lg">To</span>
                    <span className="px-3 py-1 bg-purple-100 text-purple-800 rounded-lg">Main KW</span>
                  </div>
                </div>
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={(e) => e.target.files?.[0] && uploadExcel(e.target.files[0])}
                  className="hidden"
                  id="excel-upload"
                />
                <label
                  htmlFor="excel-upload"
                  className="inline-flex items-center gap-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white px-8 py-4 rounded-xl cursor-pointer hover:from-blue-700 hover:to-blue-800 shadow-lg hover:shadow-xl transition-all duration-200 font-medium text-lg"
                >
                  <Upload className="w-5 h-5" />
                  Choose Excel File
                </label>
                <p className="text-gray-500 text-sm mt-4">Supports .xlsx and .xls files</p>
              </div>
            </div>
          </div>
        )}

        {/* Article Processing */}
        {currentProject && articles.length > 0 && (
          <div className="space-y-6">
            {/* Progress Bar */}
            <div className="bg-white/60 backdrop-blur-md rounded-2xl p-6 shadow-xl border border-white/20">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Progress</h3>
                  <span className="text-sm text-gray-600">
                    Article {currentArticleIndex + 1} of {articles.length}
                  </span>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-green-600">{completedCount}</div>
                  <div className="text-sm text-gray-500">completed</div>
                </div>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                <div 
                  className="bg-gradient-to-r from-blue-500 to-purple-500 h-3 rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${progress}%` }}
                ></div>
              </div>
              <div className="flex justify-between text-xs text-gray-500 mt-2">
                <span>{Math.round(progress)}% complete</span>
                <span>{articles.length - completedCount} remaining</span>
              </div>
            </div>

            {/* Current Article */}
            {currentArticle && (
              <div className="grid lg:grid-cols-2 gap-6">
                {/* Article Input */}
                <div className="bg-white/60 backdrop-blur-md rounded-2xl p-8 shadow-xl border border-white/20">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-500 rounded-xl flex items-center justify-center">
                        <FileSpreadsheet className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <h3 className="text-xl font-semibold text-gray-900">Current Article</h3>
                        <p className="text-sm text-gray-600">Analyze content for link opportunities</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {currentArticle.status === 'completed' && (
                        <CheckCircle className="w-6 h-6 text-green-600" />
                      )}
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                        currentArticle.status === 'completed' 
                          ? 'bg-green-100 text-green-700 border border-green-200'
                          : currentArticle.status === 'analyzing'
                          ? 'bg-blue-100 text-blue-700 border border-blue-200' 
                          : 'bg-gray-100 text-gray-600 border border-gray-200'
                      }`}>
                        {currentArticle.status === 'completed' ? 'Completed' : 
                         currentArticle.status === 'analyzing' ? 'Analyzing' : 'Pending'}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold text-gray-800 mb-2 flex items-center gap-2">
                          <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                          From URL
                        </label>
                        <div className="p-4 bg-blue-50/50 border border-blue-200 rounded-xl text-sm text-gray-800 break-all font-mono">
                          {currentArticle.from_url}
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-800 mb-2 flex items-center gap-2">
                          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                          To URL
                        </label>
                        <div className="p-4 bg-green-50/50 border border-green-200 rounded-xl text-sm text-green-800 break-all font-mono">
                          {currentArticle.to_url}
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-800 mb-2 flex items-center gap-2">
                        <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                        Target Keywords
                      </label>
                      <div className="p-4 bg-purple-50/50 border border-purple-200 rounded-xl">
                        <div className="flex flex-wrap gap-2">
                          {currentArticle.main_kw.split(',').map((kw, i) => (
                            <span key={i} className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm font-medium">
                              {kw.trim()}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-800 mb-2 flex items-center gap-2">
                        <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                        HTML Content
                        <span className="ml-auto text-xs text-gray-500">{htmlContent.length} characters</span>
                      </label>
                      <div className="relative">
                        <textarea
                          value={htmlContent}
                          onChange={(e) => setHtmlContent(e.target.value)}
                          placeholder="Paste the HTML content of your article here...\n\nTip: Copy the full HTML source or article content for best analysis results."
                          className="w-full h-64 p-4 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none font-mono text-sm transition-all bg-white/80"
                        />
                        {htmlContent && (
                          <div className="absolute bottom-4 right-4 bg-white/90 backdrop-blur-sm px-2 py-1 rounded-lg text-xs text-gray-500 border">
                            {htmlContent.length > 1000 ? '✅ Good length' : '⚠️ More content recommended'}
                          </div>
                        )}
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-800 mb-2 flex items-center gap-2">
                        <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                        Custom Instructions (Optional)
                        <span className="ml-auto text-xs text-gray-500">Modify AI analysis approach</span>
                      </label>
                      <div className="relative">
                        <textarea
                          value={customPrompt}
                          onChange={(e) => setCustomPrompt(e.target.value)}
                          placeholder="Add custom instructions for the AI analysis...\n\nExamples:\n• 'Be more aggressive with link placement'\n• 'Focus on high-converting locations only'\n• 'Make the links sound more natural'\n• 'Prioritize user experience over SEO'"
                          className="w-full h-32 p-4 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 resize-none text-sm transition-all bg-white/80"
                        />
                        {customPrompt && (
                          <div className="absolute bottom-3 right-3 bg-purple-100 text-purple-700 px-2 py-1 rounded-lg text-xs font-medium">
                            Custom prompt active
                          </div>
                        )}
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {['More aggressive links', 'Conservative placement', 'Focus on user value', 'Natural language'].map((template) => (
                          <button
                            key={template}
                            onClick={() => setCustomPrompt(template === 'More aggressive links' ? 'Be more aggressive with link placement. Find 3-4 opportunities instead of 1-3.' :
                              template === 'Conservative placement' ? 'Be conservative with link placement. Only suggest links where they add genuine value to the reader.' :
                              template === 'Focus on user value' ? 'Focus primarily on user value and natural reading experience. Links should feel helpful, not promotional.' :
                              'Make the link text and integration sound very natural and conversational.')}
                            className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-xs hover:bg-purple-200 transition-colors"
                          >
                            {template}
                          </button>
                        ))}
                        {customPrompt && (
                          <button
                            onClick={() => setCustomPrompt('')}
                            className="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-xs hover:bg-gray-200 transition-colors"
                          >
                            Clear
                          </button>
                        )}
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-800 mb-2 flex items-center gap-2">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        Number of Opportunities
                        <span className="ml-auto text-xs text-gray-500">How many link opportunities to find</span>
                      </label>
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                          {[1, 2, 3, 4, 5].map((count) => (
                            <button
                              key={count}
                              onClick={() => setOpportunityCount(count)}
                              className={`w-10 h-10 rounded-lg font-semibold transition-all ${
                                opportunityCount === count
                                  ? 'bg-green-500 text-white shadow-lg'
                                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                              }`}
                            >
                              {count}
                            </button>
                          ))}
                        </div>
                        <div className="flex-1 text-right">
                          <div className="text-sm text-gray-600">
                            <span className="font-medium">Selected: {opportunityCount}</span> opportunities
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            {opportunityCount === 1 ? 'Single best opportunity - quality focused' :
                             opportunityCount === 2 ? 'Focused approach - top opportunities only' :
                             opportunityCount === 3 ? 'Balanced approach - good coverage' :
                             opportunityCount === 4 ? 'Comprehensive approach - more options' :
                             'Extensive approach - maximum opportunities'}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-4">
                      <button
                        onClick={analyzeCurrentArticle}
                        disabled={!htmlContent.trim() || isAnalyzing}
                        className="flex-1 bg-gradient-to-r from-green-600 to-emerald-600 text-white py-4 px-6 rounded-xl font-semibold hover:from-green-700 hover:to-emerald-700 disabled:from-gray-400 disabled:to-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-3 shadow-lg hover:shadow-xl transition-all duration-200 text-lg"
                      >
                        {isAnalyzing ? (
                          <>
                            <Loader className="w-5 h-5 animate-spin" />
                            Analyzing with AI...
                          </>
                        ) : (
                          <>
                            <Zap className="w-5 h-5" />
                            Analyze Article
                          </>
                        )}
                      </button>
                      
                      <button
                        onClick={() => {
                          setHtmlContent('');
                          setAnalysisResult(null);
                          navigateArticle('next');
                        }}
                        className="px-6 py-4 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 font-medium transition-all duration-200 border border-gray-200"
                      >
                        Skip
                      </button>
                    </div>

                    {/* Navigation */}
                    <div className="flex justify-between pt-6 border-t border-gray-200">
                      <button
                        onClick={() => navigateArticle('prev')}
                        disabled={currentArticleIndex === 0}
                        className="flex items-center gap-2 px-6 py-3 bg-white border-2 border-gray-200 text-gray-700 rounded-xl hover:border-blue-300 hover:text-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-all duration-200"
                      >
                        <ChevronLeft className="w-4 h-4" />
                        Previous Article
                      </button>
                      
                      <div className="flex items-center gap-2 text-sm text-gray-600 bg-gray-100 px-4 py-2 rounded-lg">
                        <span className="font-medium text-blue-600">{currentArticleIndex + 1}</span>
                        <span>of</span>
                        <span className="font-medium">{articles.length}</span>
                      </div>
                      
                      <button
                        onClick={() => navigateArticle('next')}
                        disabled={currentArticleIndex === articles.length - 1}
                        className="flex items-center gap-2 px-6 py-3 bg-white border-2 border-gray-200 text-gray-700 rounded-xl hover:border-blue-300 hover:text-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-all duration-200"
                      >
                        Next Article
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Analysis Results */}
                <div className="bg-white/60 backdrop-blur-md rounded-2xl p-8 shadow-xl border border-white/20">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl flex items-center justify-center">
                      <Target className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold text-gray-900">AI Analysis Results</h3>
                      <p className="text-sm text-gray-600">Link placement opportunities found</p>
                    </div>
                  </div>
                  
                  {!analysisResult && !isAnalyzing && (
                    <div className="text-center py-16">
                      <div className="w-20 h-20 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
                        <Target className="w-10 h-10 text-gray-400" />
                      </div>
                      <h4 className="text-lg font-semibold text-gray-900 mb-2">Ready for Analysis</h4>
                      <p className="text-gray-600 max-w-md mx-auto leading-relaxed">
                        Paste your article's HTML content and click "Analyze Article" to discover optimal link placement opportunities powered by AI
                      </p>
                    </div>
                  )}

                  {isAnalyzing && (
                    <div className="text-center py-16">
                      <div className="relative mb-8">
                        <div className="w-20 h-20 bg-gradient-to-r from-blue-500 to-purple-500 rounded-2xl flex items-center justify-center mx-auto">
                          <Loader className="w-10 h-10 text-white animate-spin" />
                        </div>
                        <div className="absolute inset-0 w-20 h-20 bg-gradient-to-r from-blue-500 to-purple-500 rounded-2xl mx-auto animate-pulse opacity-30"></div>
                      </div>
                      <h4 className="text-lg font-semibold text-gray-900 mb-2">AI Analysis in Progress</h4>
                      <p className="text-gray-600">Analyzing content and finding optimal link placement opportunities...</p>
                      <div className="flex items-center justify-center gap-2 mt-4">
                        <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></div>
                        <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                        <div className="w-2 h-2 bg-pink-500 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                      </div>
                    </div>
                  )}

                  {analysisResult && (
                    <div className="space-y-6">
                      {/* Analysis Summary */}
                      <div className="bg-gradient-to-r from-blue-50 to-purple-50 border-2 border-blue-200 rounded-2xl p-6 mb-6">
                        <div className="flex items-center gap-2 mb-4">
                          <div className="w-6 h-6 bg-blue-500 rounded-lg flex items-center justify-center">
                            <CheckCircle className="w-4 h-4 text-white" />
                          </div>
                          <h4 className="font-bold text-blue-900 text-lg">Analysis Complete</h4>
                        </div>
                        <div className="grid md:grid-cols-2 gap-4">
                          <div className="space-y-3">
                            <div className="flex items-start gap-2">
                              <span className="text-xs font-semibold text-blue-700 bg-blue-100 px-2 py-1 rounded-full mt-0.5">TYPE</span>
                              <span className="text-sm text-gray-800 font-medium">{analysisResult.article_type}</span>
                            </div>
                            <div className="flex items-start gap-2">
                              <span className="text-xs font-semibold text-green-700 bg-green-100 px-2 py-1 rounded-full mt-0.5">INTENT</span>
                              <span className="text-sm text-gray-800 font-medium">{analysisResult.reader_intent}</span>
                            </div>
                          </div>
                          <div className="space-y-3">
                            <div className="flex items-start gap-2">
                              <span className="text-xs font-semibold text-purple-700 bg-purple-100 px-2 py-1 rounded-full mt-0.5">STRATEGY</span>
                              <span className="text-sm text-gray-800 font-medium">{analysisResult.best_strategy}</span>
                            </div>
                            <div className="flex items-start gap-2">
                              <span className="text-xs font-semibold text-orange-700 bg-orange-100 px-2 py-1 rounded-full mt-0.5">TIME</span>
                              <span className="text-sm text-gray-800 font-medium">{analysisResult.processing_time}s</span>
                            </div>
                          </div>
                        </div>
                        <div className="mt-4 pt-4 border-t border-blue-200">
                          <button
                            onClick={() => {
                              setAnalysisResult(null);
                              analyzeCurrentArticle();
                            }}
                            disabled={isAnalyzing}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 disabled:opacity-50 text-sm font-medium transition-colors"
                          >
                            <Zap className="w-4 h-4" />
                            Re-analyze with Current Settings
                          </button>
                        </div>
                      </div>

                      {/* Opportunities */}
                      <div>
                        <div className="flex items-center justify-between mb-6">
                          <h4 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                            <div className="w-6 h-6 bg-green-500 rounded-lg flex items-center justify-center">
                              <Target className="w-4 h-4 text-white" />
                            </div>
                            Link Opportunities
                          </h4>
                          <div className="flex items-center gap-3">
                            <div className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-semibold">
                              {analysisResult.opportunities.length} found
                            </div>
                            {analysisResult.opportunities.length > 1 && (
                              <div className="flex items-center gap-2 bg-blue-50 px-3 py-1 rounded-full">
                                <button
                                  onClick={() => setCurrentOpportunityIndex(Math.max(0, currentOpportunityIndex - 1))}
                                  disabled={currentOpportunityIndex === 0}
                                  className="p-1 rounded-full hover:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                  <ChevronLeft className="w-4 h-4 text-blue-600" />
                                </button>
                                <span className="text-sm text-blue-700 font-medium min-w-[3rem] text-center">
                                  {currentOpportunityIndex + 1} of {analysisResult.opportunities.length}
                                </span>
                                <button
                                  onClick={() => setCurrentOpportunityIndex(Math.min(analysisResult.opportunities.length - 1, currentOpportunityIndex + 1))}
                                  disabled={currentOpportunityIndex === analysisResult.opportunities.length - 1}
                                  className="p-1 rounded-full hover:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                  <ChevronRight className="w-4 h-4 text-blue-600" />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                        
                        {/* Single Opportunity Display */}
                        {analysisResult.opportunities.length > 0 && (
                          <div className="border-2 border-gray-200 rounded-2xl p-6 hover:border-blue-300 transition-all duration-200 bg-white/80">
                            {(() => {
                              const opportunity = analysisResult.opportunities[currentOpportunityIndex];
                              return (
                                <>
                                  <div className="flex items-start justify-between mb-4">
                                    <div className="flex items-center gap-3">
                                      <div className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold border-2 ${getRatingColor(opportunity.rating)}`}>
                                        <Target className="w-4 h-4" />
                                        {opportunity.rating}/10
                                      </div>
                                      <div className="text-sm text-gray-500">
                                        Opportunity #{opportunity.id}
                                      </div>
                                    </div>
                                  </div>
                                  
                                  <div className="space-y-4">
                                    <div className="bg-blue-50/50 rounded-xl p-4 border border-blue-200">
                                      <h5 className="font-semibold text-blue-900 text-sm mb-2 flex items-center gap-2">
                                        <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                                        Location & Context
                                      </h5>
                                      <p className="text-sm text-blue-800 font-medium mb-1">{opportunity.location}</p>
                                      <p className="text-sm text-gray-700">{opportunity.context}</p>
                                    </div>
                                    
                                    <div className="bg-purple-50/50 rounded-xl p-4 border border-purple-200">
                                      <h5 className="font-semibold text-purple-900 text-sm mb-2 flex items-center gap-2">
                                        <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
                                        AI Reasoning
                                      </h5>
                                      <p className="text-sm text-gray-700">{opportunity.reasoning}</p>
                                    </div>
                                    
                                    <div className="bg-green-50/50 rounded-xl p-4 border border-green-200">
                                      <h5 className="font-semibold text-green-900 text-sm mb-2 flex items-center gap-2">
                                        <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                                        User Value
                                      </h5>
                                      <p className="text-sm text-gray-700">{opportunity.user_value}</p>
                                    </div>
                                    
                                    <div className="space-y-4">
                                      <div>
                                        <label className="block text-sm font-semibold text-gray-800 mb-2 flex items-center gap-2">
                                          <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                                          Original Text
                                        </label>
                                        <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4 text-sm text-gray-800 font-mono">
                                          {opportunity.old_text}
                                        </div>
                                      </div>
                                      
                                      <div>
                                        <label className="block text-sm font-semibold text-gray-800 mb-2 flex items-center gap-2">
                                          <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                                          With Link Added
                                        </label>
                                        <div className="bg-green-50 border-2 border-green-200 rounded-xl p-4 text-sm text-gray-800 font-mono">
                                          <div dangerouslySetInnerHTML={{ __html: opportunity.new_text }} />
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </>
                              );
                            })()}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default TheSEOStrategist;