# Textbook Quiz Helper Scripts

These scripts were created to streamline the creation of online quizzes scrapted from books and Udemy. I currently have one for Sybex (book) Practice Test's and Dion's Practice Exams on Udemy. I will make more as needed. I will not provide raw or json files. 

The majority of the work is copy and pasting these into a file and adding the appropriate suffix indicator and adding them to the quiz_generators folder. However, files will often require tweaking to get the appropriate result. For example, I needed to manually append lines when they began with an IP address so they weren't read as a new question. If you have any thoughts on improving this, send me a note. 

None of my scripts delete raw files. This is becuase I've had to go back and adjust them after creating the json file. 

### sybex_q.py

* input file: txt that ends with _rawq
* Everything between Chapter and the next question line will be deleted. 
* Questions must be preceeded by a number follwed by a period and a space. 
* Numbers must not be equal to the immediately previous or next number. 
* Numbers do not need to be sequential or unique ine the file. 

* Choice lines must be preceeded with a single capital letter follwed by a period and a space. 
* Everything between Chapter and the next question line will be deleted. 
* output file: will replace _rawq with _q

### sybex_a.py

* Input file: txt that ends with _rawa  
* Text should be numbered lines followed by the letter answer/s and explanation (copy and paste them from the appendix into a txt file). 
* The number will be moved to its own line preceeded with a blank line. 
* A string of capital letters followed by a comma or period and a space will be read as a set of answers to the question and appear in its own line. 
* An answer indicator "-" will preceed the answer line; commas and periods will be stripped.
* An explanation indicator "--" preceed the explanation line.
* Explanations lines will be moved to the same line.
* Output file: will replace _rawa with _a

### sybex_quiz.py

I separated these into 2 steps to make it easier to troublehoot if the _q and _a otuput files don't match for whatever reason. It may require adjusting to get it to work. Line numbers are provided if any issues found. 

* Input file: txt that ands with _a and _q (auto generated from sybex_a.py and sybex_q.py)
* The numbers in _a and _q must appear in the same order. 
* Questions from _q will be added as "q" items.
* Choices from _q will be added as "c" items.
* Answers from _a will be matched to the beginning letter of Choices from _q.
* Once the answer/s is matched to the choice/s, the answer will be added as "a" items.
* The explanation text will be added as an "e" item. 
* Both choice and answer letters are stripped before being added to the json file. 
* Both question and explanation indicators are stripped before being added to the json file. 
* Prompt to confirm it is ok to delete temporary files once json file is created. 
* Output file: file.json

### dion_quiz.py

* Input file: txt that ends with _rawm
* Takes the result text from Jason Dion quizzes on Udemy and parses them into a quizsail json file. 
* Parses the correct answer/s
* Output file: file.json

### manual_quiz.py

* Input file: txt that ends with _rawm
* Use this script if the answers and explanations follow the question/choices. 
* Each question must begin with a number followed by a period and a space. 
* Each choice must begin with a capital letter followed by a period and a space. 
* All other lines will be assumed to be part of an explanation. 
* Explanations are not required. While the array item can be added after the fact, the text will need to be pasted manually. 
* Output file: file.json

### explanation_adder.py

I considered that I might need this for older question sets just in case. If the "e" is missing or otherwise blank, the app will display: Explanation not provided

* input file: will run on all .json files in the directQuory
* it adds an "e" item to every question set. 
* output file: will add _u to the name of your json file. 

### Prerequisites

* python3

[Back to main](https://github.com/lfost42/quizsail2)