import re
import json

def parse_questions_to_json(input_file, output_json):
    with open(input_file, 'r') as f:
        lines = f.readlines()
    
    questions_list = []
    state = 'start'
    current_question_lines = []
    current_choices = []
    current_choice = None
    current_answer_letters = None
    current_question_number = None
    current_explanation_lines = []
    
    index = 0
    while index < len(lines):
        line = lines[index]
        stripped_line = line.strip()
        raw_line = line.rstrip('\n')  # Preserve original formatting
        
        if state == 'start':
            # Match both "Question X:" and "X. " patterns
            match_question = re.match(r'^Question\s+(\d+):', stripped_line)
            match_numbered = re.match(r'^(\d+)\.\s', stripped_line)
            
            if match_question:
                state = 'question'
                current_question_number = match_question.group(1)
                rest = raw_line[len(match_question.group(0)):]
                if rest:
                    current_question_lines.append(rest)
            elif match_numbered:
                state = 'question'
                current_question_number = match_numbered.group(1)
                rest = raw_line[len(match_numbered.group(0)):]
                if rest:
                    current_question_lines.append(rest)
        
        elif state == 'question':
            if re.match(r'^[A-Z]\.\s', stripped_line) or stripped_line.startswith('Answer:'):
                state = 'choices'
                index -= 1  # Reprocess line in choices state
            else:
                if raw_line:
                    current_question_lines.append(raw_line)
        
        elif state == 'choices':
            if re.match(r'^[A-Z]\.\s', stripped_line):
                if current_choice is not None: 
                    current_choices.append(current_choice)
                # Start a new choice
                current_choice = re.sub(r'^[A-Z]\.\s*', '', raw_line).strip()
            elif stripped_line.startswith('Answer:'):
                if current_choice is not None:
                    current_choices.append(current_choice)
                    current_choice = None
                answer_str = stripped_line[len('Answer:'):].strip()
                current_answer_letters = re.findall(r'[A-Z]', answer_str)
                state = 'after_answer'
            else:
                # Continuation of current choice
                if current_choice is not None:
                    current_choice += ' ' + raw_line.strip()
        
        elif state == 'after_answer':
            if re.match(r'^Explanation:', stripped_line, re.IGNORECASE):
                # Capture explanation with original formatting
                exp_part = re.sub(r'^Explanation:\s*', '', raw_line, flags=re.IGNORECASE)
                if exp_part:
                    current_explanation_lines.append(exp_part.strip())
                state = 'explanation'
            else:
                state = 'done'
                index -= 1  # Reprocess current line
        
        elif state == 'explanation':
            # Check for next question or blank line
            next_question = (
                re.match(r'^Question\s+\d+:', stripped_line) or 
                re.match(r'^\d+\.\s', stripped_line)
            )
            if not stripped_line or next_question:
                state = 'done'
                index -= 1  # Reprocess this line
            else:
                current_explanation_lines.append(raw_line.strip())  # Preserve original line
        
        if state == 'done':
            # Join question lines with spaces
            question_text = ' '.join(current_question_lines).strip()
            
            # Choices are already stored in current_choices
            choices_clean = current_choices
            
            answers_clean = []
            if current_answer_letters:
                for letter in current_answer_letters:
                    idx = ord(letter) - ord('A')
                    if 0 <= idx < len(choices_clean):
                        answers_clean.append(choices_clean[idx])
            
            q_dict = {
                "q": question_text,
                "c": choices_clean,
                "a": answers_clean
            }
            if current_explanation_lines:
                # Join explanation lines with spaces
                q_dict["e"] = ' '.join(current_explanation_lines).strip()
            
            questions_list.append(q_dict)
            
            # Reset state
            state = 'start'
            current_question_lines = []
            current_choices = []
            current_choice = None
            current_answer_letters = None
            current_question_number = None
            current_explanation_lines = []
        
        index += 1
    
    # Handle last question if file ends without trailing newline
    if state != 'start':
        question_text = ' '.join(current_question_lines).strip()
        choices_clean = current_choices
        
        answers_clean = []
        if current_answer_letters:
            for letter in current_answer_letters:
                idx = ord(letter) - ord('A')
                if 0 <= idx < len(choices_clean):
                    answers_clean.append(choices_clean[idx])
        
        q_dict = {
            "q": question_text,
            "c": choices_clean,
            "a": answers_clean
        }
        if current_explanation_lines:
            q_dict["e"] = ' '.join(current_explanation_lines).strip()
        
        questions_list.append(q_dict)
    
    # Manually write JSON with proper newline handling
    with open(output_json, 'w') as f:
        f.write('[\n')
        for i, q in enumerate(questions_list):
            if i > 0:
                f.write(',\n')
            
            # Start building the question entry
            output = '    {\n'
            
            # Add question with direct string formatting
            q_str = q['q'].replace('"', '\\"')  # Escape double quotes
            output += f'        "q": "{q_str}",\n'
            
            # Add choices with json.dumps to handle list formatting
            c_str = json.dumps(q['c'], ensure_ascii=False)
            output += f'        "c": {c_str},\n'
            
            # Add answers
            a_str = json.dumps(q['a'], ensure_ascii=False)
            output += f'        "a": {a_str}'
            
            # Add explanation if it exists
            if 'e' in q:
                e_str = q['e'].replace('"', '\\"')  # Escape double quotes
                output += f',\n        "e": "{e_str}"'
            
            output += '\n    }'
            f.write(output)
        
        f.write('\n]')

if __name__ == "__main__":
    input_filename = 'input.txt'
    output_json_filename = 'output.json'
    parse_questions_to_json(input_filename, output_json_filename)