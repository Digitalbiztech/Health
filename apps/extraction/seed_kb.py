# apps/extraction/seed_kb.py
import json
import logging
import uuid
import sys
from app.rag.llm import get_openai_embeddings, get_db_connection
from app.rag.ingestion import split_text

logging.basicConfig(level=logging.INFO, format="%(asctime)s | %(levelname)s | %(message)s")
logger = logging.getLogger(__name__)

BIOMARKER_GUIDELINES = [
    {
        "topic": "Fasting Blood Glucose Guidelines",
        "content": (
            "Fasting blood glucose measures the concentration of glucose in the blood after an 8-hour fast. "
            "Normal/optimal levels are between 70 and 99 mg/dL. "
            "Fasting glucose levels between 100 and 125 mg/dL indicate Prediabetes (impaired fasting glucose), "
            "which suggests elevated insulin resistance. Levels of 126 mg/dL or higher on two separate tests "
            "indicate Diabetes. For prediabetic levels, clinicians recommend reducing intake of refined sugars, "
            "increasing dietary fiber, and engaging in regular moderate-intensity physical activity (150 minutes per week)."
        ),
        "metadata": {"biomarker": "GLUCOSE", "category": "metabolic"}
    },
    {
        "topic": "Total Cholesterol and Lipid Panels",
        "content": (
            "Total cholesterol represents the sum of HDL, LDL, and VLDL cholesterol in the blood. "
            "Desirable total cholesterol is under 200 mg/dL. Borderline high is 200-239 mg/dL, and high cholesterol is "
            "240 mg/dL and above. High total cholesterol increases the risk of cardiovascular disease and arterial plaque build-up. "
            "Dietary recommendations to lower cholesterol include reducing saturated fats and trans fats, while increasing "
            "soluble fiber and omega-3 fatty acids (found in fish, nuts, and olive oil). Regular aerobic exercise is highly effective."
        ),
        "metadata": {"biomarker": "CHOLESTEROL_TOTAL", "category": "lipids"}
    },
    {
        "topic": "HDL Cholesterol (Good Cholesterol)",
        "content": (
            "High-Density Lipoprotein (HDL) cholesterol is known as the 'good' cholesterol because it helps transport "
            "cholesterol from other parts of your body back to your liver, which removes it. "
            "An optimal HDL level is 60 mg/dL or higher. Low HDL is under 40 mg/dL for men and under 50 mg/dL for women, "
            "representing an independent risk factor for cardiovascular disease. "
            "To raise HDL levels, focus on regular cardiovascular exercise, smoking cessation, consuming healthy fats "
            "(olive oil, avocados), and moderate weight reduction."
        ),
        "metadata": {"biomarker": "CHOLESTEROL_HDL", "category": "lipids"}
    },
    {
        "topic": "LDL Cholesterol (Bad Cholesterol)",
        "content": (
            "Low-Density Lipoprotein (LDL) cholesterol is often referred to as the 'bad' cholesterol because high levels "
            "can lead to plaque build-up (atherosclerosis) in arteries, increasing the risk of heart attacks and strokes. "
            "An optimal LDL level is under 100 mg/dL. Near optimal is 100-129 mg/dL, borderline high is 130-159 mg/dL, and "
            "high is 160 mg/dL or above. Lifestyle recommendations include a Mediterranean diet, aerobic exercise, and "
            "maintaining a healthy body weight."
        ),
        "metadata": {"biomarker": "CHOLESTEROL_LDL", "category": "lipids"}
    },
    {
        "topic": "Hemoglobin A1c (HbA1c) Guidelines",
        "content": (
            "The HbA1c test measures the average amount of glucose attached to hemoglobin in red blood cells over the past "
            "3 months. A normal HbA1c level is below 5.7%. A level between 5.7% and 6.4% indicates prediabetes, showing "
            "a high risk of developing type 2 diabetes. A level of 6.5% or higher indicates diabetes. "
            "To manage and lower HbA1c, focus on portion control, choosing complex carbohydrates over simple sugars, "
            "consistent activity levels, and stress management."
        ),
        "metadata": {"biomarker": "HBA1C", "category": "metabolic"}
    }
]

def seed_knowledge_base():
    logger.info("Initializing OpenAI Embeddings client...")
    try:
        embeddings = get_openai_embeddings()
    except Exception as e:
        logger.error("Failed to initialize embeddings: %s", e)
        sys.exit(1)

    logger.info("Connecting to database...")
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                # Clear existing knowledge base chunks to avoid duplication
                logger.info("Clearing existing knowledge base chunks...")
                cur.execute('DELETE FROM "knowledge_base_chunks"')
                
                # Embed and insert each guideline, chunking long articles.
                total_chunks = 0
                for guideline in BIOMARKER_GUIDELINES:
                    logger.info("Embedding topic: %s", guideline["topic"])
                    pieces = split_text(guideline["content"]) or [guideline["content"]]
                    vectors = embeddings.embed_documents(pieces)
                    for idx, (piece, vector) in enumerate(zip(pieces, vectors)):
                        vector_str = f"[{','.join(map(str, vector))}]"
                        chunk_id = str(uuid.uuid4())
                        metadata = {**guideline["metadata"], "chunk_index": idx, "chunk_count": len(pieces)}
                        cur.execute(
                            """
                            INSERT INTO "knowledge_base_chunks" (
                                "id", "topic", "content", "metadata", "embedding"
                            ) VALUES (%s, %s, %s, %s, %s::vector)
                            """,
                            (
                                chunk_id,
                                guideline["topic"],
                                piece,
                                json.dumps(metadata),
                                vector_str,
                            ),
                        )
                        total_chunks += 1
                    logger.info("Saved %d chunk(s) for topic: %s", len(pieces), guideline["topic"])

        logger.info("Knowledge base successfully seeded with %d chunks from %d items!", total_chunks, len(BIOMARKER_GUIDELINES))
    except Exception as e:
        logger.error("Failed to seed knowledge base: %s", e)
        sys.exit(1)

if __name__ == "__main__":
    seed_knowledge_base()
