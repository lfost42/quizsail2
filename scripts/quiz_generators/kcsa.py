import json
import os
from pathlib import Path

def parse_quiz_file(file_path):
    """Parse quiz questions from a text file with specific format"""
    
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    questions = []
    
    # Split content by double newlines (two blank lines between questions)
    # Using \n\n\n to ensure we capture exactly 2+ blank lines
    question_blocks = content.strip().split('\n\n\n')
    
    for block in question_blocks:
        if not block.strip():
            continue
            
        lines = [line.rstrip() for line in block.split('\n')]
        
        # Find question (first non-empty line)
        q = ""
        choices = []
        answer = ""
        explanation = ""
        
        i = 0
        # Get question
        while i < len(lines) and not lines[i].strip():
            i += 1
        if i < len(lines):
            q = lines[i].strip()
            i += 1
        
        # Collect choices until we hit "Correct answer:"
        while i < len(lines):
            line = lines[i].strip()
            if line.startswith("Correct answer:"):
                break
            if line:  # Only add non-empty lines as choices
                choices.append(line)
            i += 1
        
        # Get answer
        if i < len(lines) and lines[i].strip().startswith("Correct answer:"):
            answer_text = lines[i].replace("Correct answer:", "").strip()
            # Handle comma-separated answers
            if ',' in answer_text:
                answer = [a.strip() for a in answer_text.split(',')]
            else:
                answer = answer_text
            i += 1
        
        # Get explanation
        if i < len(lines) and lines[i].strip().startswith("Explanation:"):
            explanation = lines[i].replace("Explanation:", "").strip()
        
        # Create question object
        question_obj = {
            "q": q,
            "c": choices,
            "a": answer,
            "e": explanation
        }
        
        questions.append(question_obj)
    
    return questions

def save_questions_to_json(questions, output_dir="OutputFiles"):
    """Save parsed questions to JSON file"""
    
    # Create OutputFiles directory if it doesn't exist
    output_path = Path(output_dir)
    output_path.mkdir(exist_ok=True)
    
    # Define output file path
    json_file = output_path / "quiz_questions.json"
    
    # Save to JSON
    with open(json_file, 'w', encoding='utf-8') as f:
        json.dump(questions, f, indent=2, ensure_ascii=False)
    
    return json_file

def main():
    # Define file paths
    input_file = "kcsa.txt"
    
    # Check if input file exists
    if not os.path.exists(input_file):
        print(f"Error: Input file '{input_file}' not found!")
        print(f"Looking for file in: {os.path.abspath('.')}")
        return
    
    print(f"Reading questions from: {input_file}")
    
    # Parse the file
    questions = parse_quiz_file(input_file)
    
    # Save to JSON in OutputFiles folder
    output_file = save_questions_to_json(questions)
    
    # Display results
    print(f"\nSuccessfully parsed {len(questions)} question(s)")
    print(f"Output saved to: {output_file}")
    
    # Print summary
    print("\n=== SUMMARY ===")
    for i, q in enumerate(questions, 1):
        print(f"Question {i}:")
        print(f"  Q: {q['q'][:80]}...")
        print(f"  Choices: {len(q['c'])} options")
        print(f"  Answer: {q['a']}")
        print()

if __name__ == "__main__":
    main()