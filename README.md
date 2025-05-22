# Research Paper Summarization System

A modern web application that automatically fetches, analyzes, and summarizes research papers from arXiv. The system uses GPT-4 to generate detailed summaries and insights from academic papers across multiple scientific domains.

## Features

- **Automated Paper Processing**:
  - Daily fetching of new papers from arXiv
  - Parallel processing of multiple categories
  - Smart paper selection based on impact and novelty
  - PDF text extraction and analysis
  - Detailed summaries using GPT-4

- **Categories Covered**:
  - Machine Learning (cs.LG)
  - Natural Language Processing (cs.CL)
  - Computer Vision (cs.CV)
  - Statistical ML (stat.ML)
  - Quantum Physics (quant-ph)
  - Nuclear Theory (nucl-th)
  - Nuclear Experiment (nucl-ex)
  - Materials Science (cond-mat.mtrl-sci)
  - Galaxy Astrophysics (astro-ph.GA)
  - Neurons & Cognition (q-bio.NC)
  - Crypto & Security (cs.CR)

- **Modern Web Interface**:
  - Clean, responsive design
  - Category-based browsing
  - Paper details with comprehensive summaries
  - Real-time generation status updates
  - Pagination and sorting options

## Tech Stack

- **Backend**:
  - FastAPI (Python web framework)
  - MongoDB (document storage)
  - arXiv API (paper fetching)
  - OpenAI GPT-4 (paper analysis)
  - PyPDF2 (PDF processing)
  - Async processing with asyncio

- **Frontend**:
  - Next.js 13+ (React framework)
  - Tailwind CSS (styling)
  - TypeScript
  - Axios (API client)

## Setup

1. **Prerequisites**:
   ```bash
   # Install Python 3.8+ and Node.js 16+
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

2. **Environment Variables**:
   Create a `.env` file in the root directory:
   ```env
   OPENAI_API_KEY=your_openai_api_key
   MONGODB_URI=your_mongodb_connection_string
   ```

3. **Backend Setup**:
   ```bash
   cd backend
   pip install -r requirements.txt
   python main.py
   ```

4. **Frontend Setup**:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

## API Endpoints

- `GET /api/generate`: Trigger paper fetching and summarization
- `GET /api/categories`: List all available categories
- `GET /api/category/{slug}`: Get papers for a specific category
- `GET /api/blog/{slug}`: Get detailed paper information
- `GET /api/papers`: Get papers with filtering and pagination
- `GET /api/generation-status`: Check paper generation status

Query Parameters:
- `date`: Filter by date (YYYY-MM-DD)
- `page`: Page number for pagination
- `per_page`: Items per page
- `sort_by`: Sort field (published_date, title, generation_date)
- `sort_order`: Sort direction (asc, desc)

## Features in Detail

### Paper Selection
- Papers are scored based on:
  - Innovation and novelty
  - Potential impact
  - Technical significance
  - Clarity of contribution

### Summary Generation
Each paper summary includes:
- Main objective and motivation
- Key methodology
- Significant findings
- Technical details
- Potential impact and applications

### Performance Optimizations
- Parallel processing of categories
- Concurrent PDF analysis
- Async MongoDB operations
- Efficient caching
- No duplicate paper processing

## Development

### Running Tests
```bash
# Backend tests
cd backend
pytest

# Frontend tests
cd frontend
npm test
```

### Code Style
```bash
# Backend
black .
flake8

# Frontend
npm run lint
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

MIT License - see LICENSE file for details 