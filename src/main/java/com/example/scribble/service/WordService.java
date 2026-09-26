package com.example.scribble.service;

import org.springframework.stereotype.Service;

import java.util.*;

@Service
public class WordService {

    private final List<String> words = Arrays.asList(
            "apple", "banana", "guitar", "elephant", "sunflower", "mountain",
            "rainbow", "castle", "dolphin", "bicycle", "volcano", "penguin",
            "spaceship", "umbrella", "butterfly", "dragon", "lighthouse", "robot",
            "pizza", "octopus", "waterfall", "cactus", "snowman", "helicopter",
            "kangaroo", "violin", "pumpkin", "telescope", "sandwich", "windmill",
            "campfire", "jellyfish", "skateboard", "pyramid", "unicorn", "tornado",
            "lantern", "compass", "hammock", "anchor", "cupcake", "beehive",
            "glacier", "flamingo", "typewriter", "saxophone", "waterslide", "igloo"
    );

    private final Random random = new Random();

    public String randomWord() {
        return words.get(random.nextInt(words.size()));
    }

    public List<String> randomChoices(int count) {
        List<String> shuffled = new ArrayList<>(words);
        Collections.shuffle(shuffled, random);
        return shuffled.subList(0, Math.min(count, shuffled.size()));
    }
}
