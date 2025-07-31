import os
import json
import re

# --- STEP 1: Find the input file ---
input_file = None
for file in os.listdir('.'):
    if file.endswith('_rawd.txt'):
        input_file = file
        break

if input_file is None:
    print("No file ending with '_rawd.txt' found.")
    exit()

# --- STEP 2: Process raw file into temporary _dion.txt ---
output_dir = 'OutputFiles'
os.makedirs(output_dir, exist_ok=True)

with open(input_file, 'r') as f:
    raw_lines = f.readlines()

processed = []
current_idx = 0
correct_ans = []
skip = 0
in_question = False
current_choices = []
question_written = False

def finalize_question(correct_ans, processed, current_choices):
    if correct_ans:
        processed.append("===ANSWERS===\n")
        for ans in correct_ans:
            processed.append(f"{ans}\n")
        processed.append("===EXPLANATION===\n")
        correct_ans = []
    return correct_ans, processed, []

while current_idx < len(raw_lines):
    line = raw_lines[current_idx]
    stripped = line.strip()
    
    # Handle Domain section
    if stripped == 'Domain':
        skip = 2
        current_idx += 1
        continue
    if skip > 0:
        skip -= 1
        current_idx += 1
        continue
        
    # Handle question start - both patterns
    if re.match(r'Question \d+', stripped) or re.match(r'^\d+\. ', line):
        # Finalize previous question
        correct_ans, processed, current_choices = finalize_question(correct_ans, processed, current_choices)
        in_question = True
        question_written = False
        
        # Add QUESTION delimiter
        processed.append("===QUESTION===\n")
        
        # Process new pattern
        if re.match(r'^\d+\. ', line):
            question_text = re.sub(r'^\d+\.\s+', '', line, 1)
            processed.append(question_text)
            current_idx += 1
            question_written = True
            continue
        else:
            current_idx += 1
            continue
        
    if stripped in ['Your answer is incorrect', 'Incorrect']:
        current_idx += 1
        continue
        
    # Handle correct answers from markers
    if stripped in ['Your selection is correct', 'Correct answer', 'Your answer is correct']:
        current_idx += 1
        if current_idx < len(raw_lines):
            ans_line = raw_lines[current_idx]
            ans = ans_line.strip()
            correct_ans.append(ans)
            processed.append(ans_line)
            current_idx += 1
        continue
    
    # Handle correct answers from repeated choices
    if in_question and stripped and question_written and stripped in current_choices:
        correct_ans.append(stripped)
        current_idx += 1
        continue
    
    if stripped == 'Overall explanation' and correct_ans:
        processed.append("===ANSWERS===\n")
        for ans in correct_ans:
            processed.append(f"{ans}\n")
        processed.append("===EXPLANATION===\n")
        if current_idx + 1 < len(raw_lines):
            processed.append(raw_lines[current_idx + 1])
            current_idx += 2
        else:
            current_idx += 1
        correct_ans = []
        current_choices = []
        in_question = False
        continue
    
    # Process content
    if stripped:
        if in_question and not question_written:
            processed.append(line)
            question_written = True
        else:
            processed.append(line)
            if in_question and question_written and stripped not in current_choices:
                current_choices.append(stripped)
    current_idx += 1

# Finalize last question
correct_ans, processed, current_choices = finalize_question(correct_ans, processed, current_choices)

# Write temporary file
temp_file = os.path.join(output_dir, input_file.replace('_rawd.txt', '_dion.txt'))
with open(temp_file, 'w') as f:
    f.writelines(processed)

# --- STEP 3: Parse temporary file into JSON using delimiters ---
with open(temp_file, 'r') as f:
    lines = []
    for line in f:
        stripped_line = line.strip()
        if stripped_line:
            stripped_line = stripped_line.replace('\\n', '\n')
            lines.append(stripped_line)

quiz_data = []
current_q = {}
current_section = None

for line in lines:
    if line == "===QUESTION===":
        # Save previous question if exists
        if current_q:
            quiz_data.append(current_q)
        # Start new question
        current_q = {"q": "", "c": [], "a": [], "e": ""}
        current_section = "question"
    elif line == "===ANSWERS===":
        current_section = "answers"
    elif line == "===EXPLANATION===":
        current_section = "explanation"
    else:
        if current_section == "question":
            if not current_q["q"]:
                current_q["q"] = line
            else:
                current_q["c"].append(line)
        elif current_section == "answers":
            current_q["a"].append(line)
        elif current_section == "explanation":
            # Only add if not a section delimiter
            if not re.match(r'^(===QUESTION===|===ANSWERS===|===EXPLANATION===)$', line):
                current_q["e"] = re.sub(
                    r'For support or reporting issues,.*?Thank you\.?', 
                    '', 
                    line, 
                    flags=re.IGNORECASE | re.DOTALL
                ).strip()

# Add last question if exists
if current_q:
    quiz_data.append(current_q)

# --- STEP 4: Write JSON ---
output_file = os.path.join(output_dir, input_file.replace('_rawd.txt', '.json'))
with open(output_file, 'w') as f:
    json.dump(quiz_data, f, indent=2)

os.remove(temp_file)

print(f"JSON quiz saved to: {output_file}")