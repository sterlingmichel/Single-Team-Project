#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import unittest


class RestCalls:

    def singleAppTest(url):
        try:
            r = requests.post(url, timeout=1)
            r.raise_for_status()
            return r.status_code
        except requests.exceptions.Timeout as errt:
            print(errt)
            raise
        except requests.exceptions.HTTPError as errh:
            print(errh)
            raise
        except requests.exceptions.ConnectionError as errc:
            print(errc)
            raise
        except requests.exceptions.RequestException as err:
            print(err)
            raise


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
    def test_valid_url(self):
        self.assertEqual(200,RestCalls.google_do_something('https://single-team-project.onrender.com/'))

    def test_exception(self):
        self.assertRaises(
            requests.exceptions.Timeout,
            RestCalls.singleAppTest,
            "https://single-team-project.onrender.com/",
        )

    def test_api_add_contact_url(self):
        self.assertEqual(200, RestCalls.singleAppTest('https://single-team-project.onrender.com/api/add_contact'))

    def test_api_edit_contact_url(self):
        self.assertEqual(200,RestCalls.singleAppTest('https://single-team-project.onrender.com/api/edit_contact'))

    def test_api_list_contact_url(self):
        self.assertEqual(200,RestCalls.singleAppTest('https://single-team-project.onrender.com/api/list_contact'))

    def test_api_delete_contact_url(self):
        self.assertEqual(200,RestCalls.singleAppTest('https://single-team-project.onrender.com/api_delete_contact'))

    def test_api_add_user_url(self):
        self.assertEqual(200,RestCalls.singleAppTest('https://single-team-project.onrender.com/api_add_user'))

    def test_api_login_user_url(self):
        self.assertEqual(200,RestCalls.singleAppTest('https://single-team-project.onrender.com/api_login_user'))


# Main: Run Test Cases
if __name__ == "__main__":
    unittest.main()
