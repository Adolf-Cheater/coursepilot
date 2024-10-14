import os
import json
import sys
from dotenv import load_dotenv
from openai import OpenAI
from pinecone import Pinecone

# Load environment variables
load_dotenv()

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
PINECONE_API_KEY = os.getenv("PINECONE_API_KEY")

# Initialize OpenAI and Pinecone clients
openai_client = OpenAI(api_key=OPENAI_API_KEY)
pc = Pinecone(api_key=PINECONE_API_KEY)
index = pc.Index("bearpath")

def get_embedding(text):
    response = openai_client.embeddings.create(
        input=text,
        model="text-embedding-ada-002"
    )
    return response.data[0].embedding

def query_pinecone(query_vector, top_k=5):
    results = index.query(vector=query_vector, top_k=top_k, include_metadata=True)
    return results.matches

def format_context(results):
    context = ""
    for result in results:
        if 'type' in result.metadata and result.metadata['type'] == 'gpa':
            context += f"Course: {result.metadata['department']} {result.metadata['courseNumber']}\n"
            context += f"Professor: {result.metadata['professorNames']}\n"
            context += f"Term: {result.metadata['term']}\n"
            context += f"Section: {result.metadata['section']}\n"
            context += f"GPA: {result.metadata['gpa']}\n"
            context += f"Class Size: {result.metadata['classSize']}\n\n"
        elif 'type' in result.metadata and result.metadata['type'] == 'course':
            context += f"Course: {result.metadata['courseLetter']} {result.metadata['courseNumber']}\n"
            context += f"Title: {result.metadata['courseTitle']}\n"
            context += f"Units: {result.metadata['Units']}\n"
            context += f"Description: {result.metadata['courseDescription']}\n"
            context += f"Faculty: {result.metadata['facultyName']}\n\n"
    return context

def query_fine_tuned_model(prompt):
    response = openai_client.chat.completions.create(
        model="ft:gpt-4o-mini-2024-07-18:personal::AHmNGvuH",  
        messages=[
            {"role": "system", "content": "You are a knowledgeable and helpful course advisor assistant for BearPath. You are helping a student with their course-related, professor-related or gpa-related questions. Avoid answering any non course, professor, gpa related quetions or providing personal information or any information that could be used to identify a student"},
            {"role": "user", "content": prompt}
        ]
    )
    return response.choices[0].message.content

def process_query(user_question):
    # Get the embedding for the user's question
    query_vector = get_embedding(user_question)
    
    # Retrieve relevant information from Pinecone
    results = query_pinecone(query_vector)
    
    # Format the retrieved information
    context = format_context(results)
    
    # Construct the prompt for the fine-tuned model
    prompt = f"Based on the following course information:\n\n{context}\n\nUser question: {user_question}\n\nPlease provide a helpful response:"
    
    # Query the fine-tuned model
    response = query_fine_tuned_model(prompt)
    
    return response

if __name__ == "__main__":
    # Take user question from command line argument
    user_question = sys.argv[1] if len(sys.argv) > 1 else "Output straight away - 'Please enter the question again as some unexpected error occurred'"

    # Process the query
    answer = process_query(user_question)

    # Return the result as JSON for Node.js to capture
    print(json.dumps({"answer": answer}))
