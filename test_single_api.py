#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import unittest



class SingleAPI(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        pass

    @classmethod
    def tearDownClass(cls):
        pass

    def setUp(self):
        pass

    def tearDown(self):
        pass

    # Add Your Test Cases Here...
    def test_create_login(self):
        addLogin = "will add method to call api"
        
        self.assertEqual(addLogin, {})


# Main: Run Test Cases
if __name__ == "__main__":
    unittest.main()
