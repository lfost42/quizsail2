import re
import os
import json
import sys

def parse_questions(text):
    questions = []
    
    # Split the text into question blocks
    question_blocks = re.split(r'Question \d+', text)[1:]  # Skip the first empty split
    
    for block in question_blocks:
        lines = [line.strip() for line in block.split('\n')]
        question_data = {
            'q': '',  # question
            'c': [],  # choices (only the choice text)
            'a': [],  # answers (only the answer text)
            'e': []   # explanations for correct answers (list of explanation texts)
        }
        
        i = 0
        # Skip the "Skipped" line and find the question
        while i < len(lines):
            line = lines[i]
            if line and not line.startswith('Skipped'):
                question_data['q'] = line
                i += 1
                break
            i += 1
        
        # Parse choices, answers, and explanations
        current_choice = ""
        in_explanation_block = False
        current_explanation = []
        
        while i < len(lines):
            line = lines[i]
            
            if not line:  # Skip blank lines
                i += 1
                continue
            
            # Check if this line starts with "Explanation:" or is part of an explanation
            if line.startswith('Explanation:'):
                in_explanation_block = True
                # Remove "Explanation:" prefix and get the explanation text
                explanation_text = line.replace('Explanation:', '', 1).strip()
                if explanation_text:
                    current_explanation.append(explanation_text)
                i += 1
                continue
                
            # If we're in an explanation block and the line doesn't start with Explanation:,
            # but we're still collecting explanation text
            elif in_explanation_block:
                # Check if this line marks the end of explanation (starts with "Correct" or is a new choice)
                if line.startswith('Correct'):
                    # If we have collected explanation text, save it for the current correct answer
                    if current_explanation and current_choice:
                        # Join multiple lines of explanation
                        full_explanation = ' '.join(current_explanation)
                        question_data['e'].append(full_explanation)
                        current_explanation = []
                    in_explanation_block = False
                    # Now handle the "Correct" marker
                    question_data['a'].append(current_choice)
                    i += 1
                    continue
                elif any(keyword in line.lower() for keyword in ['correct', 'incorrect']):
                    # This might be a new correctness marker, end current explanation
                    if current_explanation and current_choice:
                        full_explanation = ' '.join(current_explanation)
                        question_data['e'].append(full_explanation)
                        current_explanation = []
                    in_explanation_block = False
                    # Process this line in next iteration
                    continue
                else:
                    # This is continuation of explanation text
                    current_explanation.append(line)
                    i += 1
                    continue
            
            # Handle "Correct" marker
            if line.startswith('Correct'):
                if current_choice and not any(current_choice in ans for ans in question_data['a']):
                    question_data['a'].append(current_choice)
                i += 1
                continue
                
            # Handle "Incorrect" marker - just skip it
            if line.startswith('Incorrect'):
                i += 1
                continue
            
            # If this is a regular choice line (not a marker or explanation)
            if line and line not in question_data['c']:
                question_data['c'].append(line)
                current_choice = line
                i += 1
                continue
            
            i += 1
        
        # Handle any remaining explanation at the end of the block
        if current_explanation and current_choice and current_choice in question_data['a']:
            full_explanation = ' '.join(current_explanation)
            question_data['e'].append(full_explanation)
        
        # Make sure we have the same number of explanations as correct answers
        if len(question_data['e']) != len(question_data['a']):
            # If we have fewer explanations than answers, pad with empty strings
            while len(question_data['e']) < len(question_data['a']):
                question_data['e'].append("")
            # If we have more explanations than answers, truncate
            question_data['e'] = question_data['e'][:len(question_data['a'])]
        
        questions.append(question_data)
    
    return questions

def save_to_json(questions, output_path):
    """Save parsed questions to JSON file with specified key order"""
    formatted_questions = []
    for q in questions:
        formatted_questions.append({
            'q': q['q'],
            'c': q['c'],
            'a': q['a'],
            'e': q['e']  # Now this is a list of explanations
        })
    
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(formatted_questions, f, indent=2, ensure_ascii=False)

def main():
    # Check if filename is provided as command line argument
    if len(sys.argv) > 1:
        input_filename = sys.argv[1]
    else:
        # Or look for files ending with _udemy.txt in current directory
        udemy_files = [f for f in os.listdir('.') if f.endswith('_udemy.txt')]
        if not udemy_files:
            print("No _udemy.txt files found in current directory.")
            print("Please provide a filename as argument or place a _udemy.txt file in the current directory.")
            return
        
        if len(udemy_files) > 1:
            print("Multiple _udemy.txt files found. Using the first one:", udemy_files[0])
        
        input_filename = udemy_files[0]
    
    # Check if file exists
    if not os.path.exists(input_filename):
        print(f"File '{input_filename}' not found.")
        return
    
    print(f"Reading from: {input_filename}")
    
    # Read the input file
    try:
        with open(input_filename, 'r', encoding='utf-8') as f:
            text = f.read()
    except Exception as e:
        print(f"Error reading file: {e}")
        return
    
    # Parse the questions
    questions = parse_questions(text)
    
    # Display results for verification
    print(f"\nParsed {len(questions)} questions:")
    for idx, q in enumerate(questions, 1):
        print(f"\nQuestion {idx}: {q['q']}")
        print("Choices:")
        for choice_idx, choice in enumerate(q['c'], 1):
            marker = "✓" if choice in q['a'] else " "
            print(f"  {choice_idx}. [{marker}] {choice}")
        print(f"Answers: {q['a']}")
        if q['e']:
            print(f"Explanations:")
            for exp_idx, explanation in enumerate(q['e'], 1):
                print(f"  {exp_idx}. {explanation}")
        print("-" * 80)
    
    # Create OutputFiles directory if it doesn't exist
    output_dir = "OutputFiles"
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)
        print(f"Created directory: {output_dir}")
    
    # Save to JSON file in OutputFiles directory
    base_name = os.path.splitext(input_filename)[0]
    # Remove _udemy suffix if present
    if base_name.endswith('_udemy'):
        base_name = base_name[:-6]
    
    # Get just the filename without path
    filename_only = os.path.basename(base_name)
    output_filename = f"{filename_only}.json"
    output_path = os.path.join(output_dir, output_filename)
    
    save_to_json(questions, output_path)
    print(f"\nSaved parsed data to: {output_path}")
    
    # Display summary
    print(f"\nSummary:")
    print(f"Total questions: {len(questions)}")
    single_answer = sum(1 for q in questions if len(q['a']) == 1)
    multiple_answers = sum(1 for q in questions if len(q['a']) > 1)
    print(f"  Single-answer questions: {single_answer}")
    print(f"  Multiple-answer questions: {multiple_answers}")
    
    # Count questions with explanations
    questions_with_explanations = sum(1 for q in questions if any(q['e']))
    total_explanations = sum(len(q['e']) for q in questions)
    print(f"  Questions with explanations: {questions_with_explanations}")
    print(f"  Total explanations captured: {total_explanations}")

if __name__ == "__main__":
    main()