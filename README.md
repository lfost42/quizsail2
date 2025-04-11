# QuizSail 2.0
Test Prep Engine, forked from [jmatzen](https://github.com/jmatzen/quizsail). 

I started to need additional functionality as I started to utilize this for other certificaiton exams, most notably CompTIA. I needed a way to scrape questions from a book and create quizzes out of them, especially when the questions and answers were on different pages. 

#### QuizSail is a test prep engine
The test prep engine uses a technique called *assumed competency*.  This technique assumes that if you answer the question correctly the first time that you already know the answer. Because of this, it's running on sort of an honor system, so if the user is not sure what the answer is they should not enter any answer at all instead of guessing.

QuizSail's competency system works by holding a certain number of questions from the pool in-flight.  Once the user has correctly answered a question in the in-flight state so many times in a row, the question is moved to the completed state and is not asked again.  As long as the in-flight pool is full, the next question to appear is randomly selected from the questions in the pool that aged the most so that the same question is not likely to be asked twice in a row.

## List of updates for QuizSail 2.0

⚙️ Functionality to adds line breaks (\n).  
⚙️ Text font switches to monotype when wrapped in < code > tags.  
⚙️ Upon completion of a quiz, the session is deleted and you are returned to start.  
⚙️ Explanations added to the result if available (need to populate the "e" item in the json file).  

📃 [Script](scripts/explanation_adder/) to add an json line item for explanations to any working json file.  
📃 [Script](scripts/quiz_generators) to convert the results of a Jason Dion practice test (on udemy) and parse the questions, answers, and explanations into a quizsail json file. 
📃 [Script](scripts/quiz_generators) to convert Sybex practice tests (1 file for questions/choices and 1 file for the answers/explanations) and parse the questions, answers, and explanations into a quizsail json file. 
> See my scripts [README](scripts/README.md) file for more info.  

💡 New quizzes are dynamically loaded to start menu (add them to the public/quizzes folder).  
💡 Avoids giving the same question twice in a row (mostly) unless it's the last question.  

📂 [Review Mode] added to Start: requires only one correct answer. I use this to validate a or quickly review a question set.  
📂 [Delete All Sessions] option added to Start.  
📂 [Return to Start] option added to Quiz.  

## Refresh Quiz
☑️ Log functionality that keeps track of all successful first attempts for the last 10 sessions.
☑️ Option to prune logs once there are 5 in case there are sessions that were deleted prior to starting a new one. 
☑️ Option to create a "refreshed" quiz that removes the questions that appear in logs at least 3 out of the 5 last sessions. Original quiz moved to the "retired" directory. 

## Getting Started
These instructions will get you a copy of the project up and running on your local machine.

### Prerequisites
* node

### Installing and Running
* Clone this repo. If you don't know what this means, click the green "Code" button and select "Download Zip".
* Open a terminal at the folder
* Run `npm update`
* Run `npm install`
* Run `npm start`
* Open your browser and enter `http://localhost:3000`
* For future runs, you can run `npm start` at the quizsail2 folder and navigate your browser to `localhost:3000`. 

## Deployment Notes
`docker build -t quizsail .`
`docker run --mount 'type=volume,src=quizsail,dst=/usr/src/app/data' --restart=always -i -p 49000:3000 -d quizsail`

## Contributing
Use pull requests.

## Authors
* **John Matzen** - *Initial work* - [jmatzen](https://github.com/jmatzen)
* L S - *Some CSS, HTML, JS* - [SkillAllHumans](https://github.com/SkillAllHumans)
* lynda_ - *added 2.0 upgrades* = [lfost42](https://github.com/lfost42)

## License
This project is licensed under [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/).
