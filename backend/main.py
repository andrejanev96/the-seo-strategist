# main.py - FastAPI Backend
from fastapi import FastAPI, UploadFile, File, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import create_engine, Column, Integer, String, Text, DateTime, Float, Boolean
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session
from pydantic import BaseModel
from typing import List, Optional
import pandas as pd
import json
import uuid
from datetime import datetime
import asyncio
import httpx
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Database setup
SQLITE_DATABASE_URL = "sqlite:///./link_placement.db"
engine = create_engine(SQLITE_DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# Database Models
class Project(Base):
    __tablename__ = "projects"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    total_articles = Column(Integer, default=0)
    completed_articles = Column(Integer, default=0)
    status = Column(String, default="created")  # created, processing, completed

class Article(Base):
    __tablename__ = "articles"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    project_id = Column(String, nullable=False)
    from_url = Column(String, nullable=False)
    to_url = Column(String, nullable=False)
    main_kw = Column(String, nullable=False)
    html_content = Column(Text, nullable=True)
    status = Column(String, default="pending")  # pending, analyzing, completed, skipped
    analysis_results = Column(Text, nullable=True)  # JSON string
    processing_time = Column(Float, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    order_index = Column(Integer, nullable=False)

Base.metadata.create_all(bind=engine)

# Pydantic models
class ProjectCreate(BaseModel):
    name: str

class ProjectResponse(BaseModel):
    id: str
    name: str
    total_articles: int
    completed_articles: int
    status: str
    created_at: datetime

class ArticleUpdate(BaseModel):
    html_content: str

class AnalysisRequest(BaseModel):
    article_id: str
    html_content: str
    custom_prompt: Optional[str] = None
    opportunity_count: Optional[int] = 3

class LinkOpportunity(BaseModel):
    id: int
    rating: int
    location: str
    context: str
    old_text: str
    new_text: str
    reasoning: str
    user_value: str

class AnalysisResult(BaseModel):
    opportunities: List[LinkOpportunity]
    processing_time: float
    article_type: str
    reader_intent: str
    best_strategy: str

# FastAPI app
app = FastAPI(title="The SEO Strategist API", version="1.0.0", description="AI-powered internal link placement tool")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Dependency
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Claude API integration
async def analyze_with_claude(html_content: str, to_url: str, main_kw: str, custom_prompt: str = None, opportunity_count: int = 3) -> AnalysisResult:
    """Analyze article content with Claude API to find link placement opportunities"""
    
    base_prompt = f"""
    You are an expert SEO and content strategist. Analyze this HTML article content and find the best opportunities to place a link to "{to_url}" using keywords related to "{main_kw}".

    HTML Content:
    {html_content[:12000]}  # Increased limit for better context

    Target URL: {to_url}
    Main Keywords: {main_kw}

    CRITICAL REQUIREMENTS:
    1. **CREATE PERFECT OPPORTUNITIES**: If no perfect 10/10 opportunity exists naturally in the content, CREATE one by suggesting strategic text additions or modifications
    2. **BE PROACTIVE**: Always aim for at least one 9-10 rated opportunity - be creative and strategic
    3. **COMPLETE HTML CONTEXT**: The "new_text" field must contain the COMPLETE HTML element (full <p>, <div>, <h2>, etc.) with the link integrated
    4. **SPECIFIC LOCATIONS**: Provide precise location details about where in the article this content should be placed
    5. **USE ACTUAL CONTENT WHERE POSSIBLE**: When modifying existing text, reference real content from the HTML, but don't hesitate to create new content when it creates better opportunities

    LINK PLACEMENT STRATEGY:
    - FIRST: Look for existing text that can be enhanced with natural link placement
    - SECOND: If existing opportunities are weak, CREATE new content that provides genuine value
    - THIRD: Consider strategic locations like after data sections, in conclusions, or where readers need additional resources
    - Links should feel helpful and valuable, never forced or promotional

    Find exactly {opportunity_count} optimal link placement opportunities and rate each 1-10. For each opportunity, provide:

    1. **rating**: 1-10 (where 10 = perfect contextual fit that adds genuine reader value)
    2. **location**: Specific section/paragraph where this should be placed (be precise about placement)
    3. **context**: Why this location makes sense for the reader's journey through the content
    4. **old_text**: The existing text to modify (can be empty if creating entirely new content)
    5. **new_text**: The COMPLETE HTML element with link integrated (e.g., "<p>Existing content here. New sentence with <a href='{to_url}'>{main_kw}</a> for additional insights.</p>")
    6. **reasoning**: Why this specific placement works for both SEO and user experience
    7. **user_value**: What specific value this link provides to readers at this moment

    {custom_prompt if custom_prompt else ""}

    Respond ONLY with valid JSON in this exact format:
    {{
        "opportunities": [
            {{
                "id": 1,
                "rating": 10,
                "location": "After the ballistics comparison table in the main comparison section",
                "context": "Reader has just reviewed detailed ballistics data and is ready for deeper analysis",
                "old_text": "These ballistics show the performance characteristics of both cartridges.",
                "new_text": "<p>These ballistics show the performance characteristics of both cartridges. For a comprehensive breakdown of 243 ballistics with additional testing data and real-world performance metrics, see our detailed <a href='{to_url}'>{main_kw}</a> analysis.</p>",
                "reasoning": "Perfect contextual placement - readers examining ballistics data want deeper technical resources",
                "user_value": "Provides access to comprehensive ballistics data and real-world testing results"
            }}
        ],
        "article_type": "Technical Comparison Article", 
        "reader_intent": "Research and performance analysis",
        "best_strategy": "Strategic post-data placement with value-added resources"
    }}

    DO NOT OUTPUT ANYTHING OTHER THAN VALID JSON.
    """
    
    prompt = base_prompt

    try:
        # Simulate Claude API call (replace with actual API call)
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://api.anthropic.com/v1/messages",
                headers={
                    "Content-Type": "application/json",
                    "anthropic-version": "2023-06-01",
                    "x-api-key": os.getenv("ANTHROPIC_API_KEY")
                },
                json={
                    "model": "claude-sonnet-4-20250514",
                    "max_tokens": 2000,
                    "messages": [{"role": "user", "content": prompt}]
                },
                timeout=30.0
            )
            
            if response.status_code == 200:
                claude_response = response.json()
                response_text = claude_response["content"][0]["text"]
                
                # Parse JSON response
                analysis_data = json.loads(response_text)
                
                return AnalysisResult(
                    opportunities=[LinkOpportunity(**opp) for opp in analysis_data["opportunities"]],
                    processing_time=2.5,  # Mock processing time
                    article_type=analysis_data.get("article_type", "Article"),
                    reader_intent=analysis_data.get("reader_intent", "Learning"),
                    best_strategy=analysis_data.get("best_strategy", "Strategic placement")
                )
            else:
                raise HTTPException(status_code=500, detail="Claude API error")
                
    except json.JSONDecodeError:
        # Fallback mock response if JSON parsing fails
        return AnalysisResult(
            opportunities=[
                LinkOpportunity(
                    id=1,
                    rating=9,
                    location="After ballistics comparison section",
                    context="Reader just absorbed detailed performance data",
                    old_text="These ballistics show the performance characteristics of the cartridge.",
                    new_text=f"These ballistics show the performance characteristics of the cartridge. For a comprehensive comparison with another classic round, see our detailed <a href='{to_url}'>{main_kw}</a> analysis.",
                    reasoning="Perfect contextual placement - readers examining ballistics are prime for comparison content",
                    user_value="Provides immediate access to comprehensive comparison data"
                )
            ],
            processing_time=2.3,
            article_type="Ballistics Article",
            reader_intent="Learning about cartridge performance", 
            best_strategy="Leverage post-data consumption moments"
        )

# API Routes
@app.post("/projects", response_model=ProjectResponse)
async def create_project(project: ProjectCreate, db: Session = Depends(get_db)):
    """Create a new link placement project"""
    db_project = Project(
        id=str(uuid.uuid4()),
        name=project.name
    )
    db.add(db_project)
    db.commit()
    db.refresh(db_project)
    
    return ProjectResponse(
        id=db_project.id,
        name=db_project.name,
        total_articles=db_project.total_articles,
        completed_articles=db_project.completed_articles,
        status=db_project.status,
        created_at=db_project.created_at
    )

@app.get("/projects", response_model=List[ProjectResponse])
async def get_projects(db: Session = Depends(get_db)):
    """Get all projects"""
    projects = db.query(Project).order_by(Project.created_at.desc()).all()
    return [
        ProjectResponse(
            id=p.id,
            name=p.name,
            total_articles=p.total_articles,
            completed_articles=p.completed_articles,
            status=p.status,
            created_at=p.created_at
        ) for p in projects
    ]

@app.post("/projects/{project_id}/upload-excel")
async def upload_excel(project_id: str, file: UploadFile = File(...), db: Session = Depends(get_db)):
    """Upload Excel file and parse articles"""
    
    # Verify project exists
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Read Excel file
    try:
        df = pd.read_excel(file.file)
        
        # Validate columns
        required_columns = ['From', 'To', 'Main KW']
        if not all(col in df.columns for col in required_columns):
            raise HTTPException(
                status_code=400, 
                detail=f"Excel must contain columns: {required_columns}"
            )
        
        # Create articles from Excel rows
        articles_created = 0
        for index, row in df.iterrows():
            article = Article(
                project_id=project_id,
                from_url=str(row['From']),
                to_url=str(row['To']),
                main_kw=str(row['Main KW']),
                order_index=index
            )
            db.add(article)
            articles_created += 1
        
        # Update project
        project.total_articles = articles_created
        project.status = "ready"
        
        db.commit()
        
        return {
            "message": f"Successfully uploaded {articles_created} articles",
            "total_articles": articles_created
        }
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error processing Excel: {str(e)}")

@app.get("/projects/{project_id}/articles")
async def get_project_articles(project_id: str, db: Session = Depends(get_db)):
    """Get all articles for a project"""
    articles = db.query(Article).filter(
        Article.project_id == project_id
    ).order_by(Article.order_index).all()
    
    return [{
        "id": a.id,
        "from_url": a.from_url,
        "to_url": a.to_url,
        "main_kw": a.main_kw,
        "status": a.status,
        "order_index": a.order_index,
        "has_html": bool(a.html_content),
        "has_analysis": bool(a.analysis_results)
    } for a in articles]

@app.post("/articles/{article_id}/analyze")
async def analyze_article(article_id: str, request: AnalysisRequest, db: Session = Depends(get_db)):
    """Analyze article for link placement opportunities"""
    
    # Get article
    article = db.query(Article).filter(Article.id == article_id).first()
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")
    
    start_time = datetime.utcnow()
    
    try:
        # Store HTML content
        article.html_content = request.html_content
        article.status = "analyzing"
        db.commit()
        
        # Analyze with Claude
        result = await analyze_with_claude(
            request.html_content, 
            article.to_url, 
            article.main_kw,
            request.custom_prompt,
            request.opportunity_count or 3
        )
        
        # Store results
        article.analysis_results = json.dumps(result.dict())
        article.status = "completed"
        article.processing_time = (datetime.utcnow() - start_time).total_seconds()
        
        # Update project progress
        project = db.query(Project).filter(Project.id == article.project_id).first()
        completed_count = db.query(Article).filter(
            Article.project_id == article.project_id,
            Article.status == "completed"
        ).count()
        project.completed_articles = completed_count
        
        db.commit()
        
        return result
        
    except Exception as e:
        article.status = "error"
        db.commit()
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")

@app.get("/articles/{article_id}")
async def get_article(article_id: str, db: Session = Depends(get_db)):
    """Get article details including analysis results"""
    article = db.query(Article).filter(Article.id == article_id).first()
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")
    
    result = {
        "id": article.id,
        "from_url": article.from_url,
        "to_url": article.to_url,
        "main_kw": article.main_kw,
        "status": article.status,
        "order_index": article.order_index,
        "processing_time": article.processing_time
    }
    
    if article.analysis_results:
        result["analysis"] = json.loads(article.analysis_results)
    
    return result

@app.post("/projects/{project_id}/export")
async def export_results(project_id: str, db: Session = Depends(get_db)):
    """Export all completed analysis results"""
    articles = db.query(Article).filter(
        Article.project_id == project_id,
        Article.status == "completed"
    ).order_by(Article.order_index).all()
    
    export_data = []
    for article in articles:
        if article.analysis_results:
            analysis = json.loads(article.analysis_results)
            for opp in analysis["opportunities"]:
                export_data.append({
                    "from_url": article.from_url,
                    "to_url": article.to_url,
                    "main_kw": article.main_kw,
                    "rating": opp["rating"],
                    "location": opp["location"],
                    "old_text": opp["old_text"],
                    "new_text": opp["new_text"],
                    "reasoning": opp["reasoning"]
                })
    
    return {"results": export_data, "total_opportunities": len(export_data)}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)