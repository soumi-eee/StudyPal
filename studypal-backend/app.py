from flask import Flask, request, jsonify
from flask_cors import CORS
import pytesseract
from PIL import Image
import fitz  # PyMuPDF
import os
import json
import google.generativeai as genai
from datetime import datetime
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

app = Flask(__name__)
CORS(app)

UPLOAD_FOLDER = "uploads"
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# Configure the Gemini API
try:
    genai.configure(api_key=os.getenv("GOOGLE_API_KEY"))
except Exception as e:
    print(f"Error configuring Gemini API: {e}")

# In-memory storage for extracted text
extracted_texts = {}

@app.route("/")
def home():
    return jsonify({"message": "StudyPal Backend is running (Gemini Version)!"})

@app.route("/upload", methods=["POST"])
def upload_file():
    try:
        if "file" not in request.files: return jsonify({"error": "No file uploaded"}), 400
        file = request.files["file"]
        if file.filename == "": return jsonify({"error": "No file selected"}), 400

        filepath = os.path.join(UPLOAD_FOLDER, file.filename)
        file.save(filepath)
        text, file_type = "", ""

        if file.filename.lower().endswith(".pdf"):
            file_type = "PDF"
            with fitz.open(filepath) as pdf_doc:
                for page in pdf_doc: text += page.get_text()
        elif file.filename.lower().endswith((".png", ".jpg", ".jpeg")):
            file_type = "Image"
            text = pytesseract.image_to_string(Image.open(filepath))
        else:
            os.remove(filepath)
            return jsonify({"error": "Unsupported file format"}), 400

        os.remove(filepath)
        text = text.strip()
        if not text: return jsonify({"error": "No text extracted"}), 400

        file_id = f"{file.filename}_{datetime.now().timestamp()}"
        extracted_texts[file_id] = {"filename": file.filename, "text": text}
        
        return jsonify({
            "success": True, "file_id": file_id, "filename": file.filename,
            "extracted_text": text[:500] + ("..." if len(text) > 500 else "")
        })
    except Exception as e:
        return jsonify({"error": f"Server error: {str(e)}"}), 500

@app.route("/ask", methods=["POST"])
def ask_ai():
    try:
        data = request.get_json()
        question, file_id = data.get("question", "").strip(), data.get("file_id")
        if not question: return jsonify({"error": "Please provide a question"}), 400

        context = extracted_texts.get(file_id, {}).get("text", "")
        model = genai.GenerativeModel('gemini-pro')
        
        prompt = f"Based on the following context, please answer the question.\n\nContext:\n{context}\n\nQuestion:\n{question}"
        
        response = model.generate_content(prompt)
        ai_response = response.text

        return jsonify({"success": True, "response": ai_response})
    except Exception as e:
        return jsonify({"error": f"Error with Gemini API: {str(e)}"}), 500

@app.route("/generate", methods=["POST"])
def generate_questions():
    try:
        data = request.get_json()
        file_id, q_type, count = data.get("file_id"), data.get("type", "multiple_choice"), int(data.get("count", 5))
        
        if not file_id or file_id not in extracted_texts:
            return jsonify({"error": "Please select a document first"}), 400

        context = extracted_texts[file_id]["text"]
        model = genai.GenerativeModel('gemini-pro')

        prompt = (
            f"Based on the text below, generate {count} {q_type.replace('_', ' ')} questions. "
            f"Provide the output ONLY as a valid JSON array of objects. Do not include '```json' or any other text before or after the array. "
            f"For multiple_choice, each object must have keys: 'type', 'question', 'options' (an array of 4 strings), and 'correct_answer'. "
            f"For true_false, keys: 'type', 'question', 'correct_answer'. "
            f"For short_answer, keys: 'type', 'question', 'sample_answer'.\n\n"
            f"Text: \"\"\"{context[:4000]}\"\"\""
        )
        
        response = model.generate_content(prompt)
        # Clean up the response to ensure it's valid JSON
        cleaned_response = response.text.strip().replace("```json", "").replace("```", "")
        questions = json.loads(cleaned_response)

        return jsonify({"success": True, "questions": questions})
    except Exception as e:
        return jsonify({"error": f"Error with Gemini API or parsing response: {str(e)}"}), 500

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8000, debug=True)