import random

choices = {
    1: "Rock",
    2: "Paper",
    3: "Scissors"
}

def play(user_choice):
    computer_choice = random.randint(1, 3)

    if user_choice == computer_choice:
        result = "Tie"

    elif (
        (user_choice == 1 and computer_choice == 3) or
        (user_choice == 2 and computer_choice == 1) or
        (user_choice == 3 and computer_choice == 2)
    ):
        result = "You Win"

    else:
        result = "Computer Wins"

    return {
        "user": choices[user_choice],
        "computer": choices[computer_choice],
        "result": result
    }