import React, { useState, useEffect } from 'react';
import { Upload, FileSpreadsheet, ChevronLeft, ChevronRight, Download, Loader, CheckCircle, Target, Zap } from 'lucide-react';

const API_BASE = process.env.NODE_ENV === 'production' 
  ? 'https://your-backend-url.com' 
  : 'http://localhost:8000';

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
          html_content: htmlContent
        })
      });
      
      if (response.ok) {
        const result = await response.json();
        setAnalysisResult(result);
        
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

  const navigateArticle = (direction: 'next' | 'prev') => {
    const newIndex = direction === 'next' 
      ? Math.min(currentArticleIndex + 1, articles.length - 1)
      : Math.max(currentArticleIndex - 1, 0);
    
    setCurrentArticleIndex(newIndex);
    setHtmlContent('');
    setAnalysisResult(null);
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
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">The SEO Strategist</h1>
              {currentProject && (
                <p className="text-gray-600">
                  {currentProject.name} • {completedCount}/{articles.length} completed
                </p>
              )}
            </div>
            <div className="flex items-center gap-3">
              {currentProject && articles.length > 0 && (
                <button
                  onClick={exportResults}
                  className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                >
                  <Download className="w-4 h-4" />
                  Export Results
                </button>
              )}
              <button
                onClick={() => setShowNewProject(true)}
                className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
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
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-96">
              <h3 className="text-lg font-semibold mb-4">Create New Project</h3>
              <input
                type="text"
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                placeholder="Project name..."
                className="w-full p-3 border border-gray-300 rounded-lg mb-4"
                onKeyPress={(e) => e.key === 'Enter' && createProject()}
              />
              <div className="flex gap-3">
                <button
                  onClick={createProject}
                  className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700"
                >
                  Create
                </button>
                <button
                  onClick={() => setShowNewProject(false)}
                  className="flex-1 bg-gray-300 text-gray-700 py-2 rounded-lg hover:bg-gray-400"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Project Selection */}
        {!currentProject && (
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-white rounded-lg p-6 shadow-sm border">
              <h3 className="text-lg font-semibold mb-4">Recent Projects</h3>
              {projects.length === 0 ? (
                <p className="text-gray-500">No projects yet. Create your first project!</p>
              ) : (
                <div className="space-y-3">
                  {projects.map(project => (
                    <div
                      key={project.id}
                      onClick={() => {
                        setCurrentProject(project);
                        loadProjectArticles(project.id);
                      }}
                      className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-medium">{project.name}</h4>
                          <p className="text-sm text-gray-500">
                            {project.completed_articles}/{project.total_articles} articles • {project.status}
                          </p>
                        </div>
                        <ChevronRight className="w-5 h-5 text-gray-400" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Excel Upload */}
        {currentProject && articles.length === 0 && (
          <div className="bg-white rounded-lg p-6 shadow-sm border">
            <h3 className="text-lg font-semibold mb-4">Upload Excel File</h3>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
              <FileSpreadsheet className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 mb-4">
                Upload Excel file with columns: From, To, Main KW
              </p>
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={(e) => e.target.files?.[0] && uploadExcel(e.target.files[0])}
                className="hidden"
                id="excel-upload"
              />
              <label
                htmlFor="excel-upload"
                className="inline-flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg cursor-pointer hover:bg-blue-700"
              >
                <Upload className="w-4 h-4" />
                Choose Excel File
              </label>
            </div>
          </div>
        )}

        {/* Article Processing */}
        {currentProject && articles.length > 0 && (
          <div className="space-y-6">
            {/* Progress Bar */}
            <div className="bg-white rounded-lg p-4 shadow-sm border">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">
                  Article {currentArticleIndex + 1} of {articles.length}
                </span>
                <span className="text-sm text-gray-500">
                  {completedCount} completed
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                ></div>
              </div>
            </div>

            {/* Current Article */}
            {currentArticle && (
              <div className="grid lg:grid-cols-2 gap-6">
                {/* Article Input */}
                <div className="bg-white rounded-lg p-6 shadow-sm border">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold">Current Article</h3>
                    <div className="flex items-center gap-2">
                      {currentArticle.status === 'completed' && (
                        <CheckCircle className="w-5 h-5 text-green-600" />
                      )}
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        currentArticle.status === 'completed' 
                          ? 'bg-green-100 text-green-700'
                          : currentArticle.status === 'analyzing'
                          ? 'bg-blue-100 text-blue-700' 
                          : 'bg-gray-100 text-gray-600'
                      }`}>
                        {currentArticle.status}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">From URL</label>
                      <div className="p-2 bg-gray-50 rounded text-sm text-gray-700 break-all">
                        {currentArticle.from_url}
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">To URL</label>
                      <div className="p-2 bg-gray-50 rounded text-sm text-blue-600 break-all">
                        {currentArticle.to_url}
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Keywords</label>
                      <div className="p-2 bg-gray-50 rounded text-sm text-gray-700">
                        {currentArticle.main_kw}
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">HTML Content</label>
                      <textarea
                        value={htmlContent}
                        onChange={(e) => setHtmlContent(e.target.value)}
                        placeholder="Paste article HTML content here..."
                        className="w-full h-64 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                      />
                    </div>

                    <div className="flex gap-3">
                      <button
                        onClick={analyzeCurrentArticle}
                        disabled={!htmlContent.trim() || isAnalyzing}
                        className="flex-1 bg-green-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        {isAnalyzing ? (
                          <>
                            <Loader className="w-4 h-4 animate-spin" />
                            Analyzing...
                          </>
                        ) : (
                          <>
                            <Zap className="w-4 h-4" />
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
                        className="px-4 py-3 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
                      >
                        Skip
                      </button>
                    </div>

                    {/* Navigation */}
                    <div className="flex justify-between pt-4 border-t">
                      <button
                        onClick={() => navigateArticle('prev')}
                        disabled={currentArticleIndex === 0}
                        className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <ChevronLeft className="w-4 h-4" />
                        Previous
                      </button>
                      
                      <button
                        onClick={() => navigateArticle('next')}
                        disabled={currentArticleIndex === articles.length - 1}
                        className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Next
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Analysis Results */}
                <div className="bg-white rounded-lg p-6 shadow-sm border">
                  <h3 className="text-lg font-semibold mb-4">Analysis Results</h3>
                  
                  {!analysisResult && !isAnalyzing && (
                    <div className="text-center py-12 text-gray-500">
                      <Target className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                      <p>Paste HTML content and click "Analyze Article" to find link opportunities</p>
                    </div>
                  )}

                  {isAnalyzing && (
                    <div className="text-center py-12">
                      <Loader className="w-8 h-8 mx-auto mb-4 text-blue-600 animate-spin" />
                      <p className="text-gray-600">AI is analyzing the article...</p>
                    </div>
                  )}

                  {analysisResult && (
                    <div className="space-y-6">
                      {/* Analysis Summary */}
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <h4 className="font-semibold text-blue-900 mb-2">Analysis Summary</h4>
                        <div className="text-sm space-y-1">
                          <div><span className="font-medium">Article Type:</span> {analysisResult.article_type}</div>
                          <div><span className="font-medium">Reader Intent:</span> {analysisResult.reader_intent}</div>
                          <div><span className="font-medium">Strategy:</span> {analysisResult.best_strategy}</div>
                          <div><span className="font-medium">Processing Time:</span> {analysisResult.processing_time}s</div>
                        </div>
                      </div>

                      {/* Opportunities */}
                      <div>
                        <h4 className="font-semibold text-gray-900 mb-3">
                          Link Opportunities ({analysisResult.opportunities.length} found)
                        </h4>
                        
                        <div className="space-y-4">
                          {analysisResult.opportunities.map((opportunity) => (
                            <div key={opportunity.id} className="border border-gray-200 rounded-lg p-4">
                              <div className="flex items-start justify-between mb-3">
                                <div className="flex items-center gap-3">
                                  <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${getRatingColor(opportunity.rating)}`}>
                                    <Target className="w-3 h-3" />
                                    {opportunity.rating}/10
                                  </div>
                                </div>
                                <span className="text-xs text-gray-500">#{opportunity.id}</span>
                              </div>
                              
                              <div className="space-y-3">
                                <div>
                                  <h5 className="font-medium text-gray-900 text-sm">Location & Context</h5>
                                  <p className="text-sm text-gray-600">{opportunity.location}</p>
                                  <p className="text-sm text-gray-700 mt-1">{opportunity.context}</p>
                                </div>
                                
                                <div>
                                  <h5 className="font-medium text-gray-900 text-sm">Reasoning</h5>
                                  <p className="text-sm text-gray-700">{opportunity.reasoning}</p>
                                </div>
                                
                                <div>
                                  <h5 className="font-medium text-green-700 text-sm">User Value</h5>
                                  <p className="text-sm text-gray-700">{opportunity.user_value}</p>
                                </div>
                                
                                <div className="space-y-2">
                                  <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">Original:</label>
                                    <div className="bg-red-50 border border-red-200 rounded p-2 text-xs text-gray-800">
                                      {opportunity.old_text}
                                    </div>
                                  </div>
                                  
                                  <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">With Link:</label>
                                    <div className="bg-green-50 border border-green-200 rounded p-2 text-xs text-gray-800">
                                      <div dangerouslySetInnerHTML={{ __html: opportunity.new_text }} />
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
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